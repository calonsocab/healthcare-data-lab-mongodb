#//src/scripts/denormalizer.py
"""
Synthetic Data Denormalizer

This script processes OpenEHR compositions in MongoDB and creates denormalized
documents for improved query performance.

Usage:
    python denormalizer.py --config config.json

Configuration should include:
- mongo_uri: MongoDB connection string
- source_db: Source database name
- target_db: Target database name (can be the same as source)
- compositions_collection: Source collection with compositions
- meta_collection: Target collection for metadata documents
- patient_batch_size: Number of patients to process in each batch
- strategy: Denormalization strategy (single or distributed)
- strategy_config: Specific configuration for the selected strategy
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime
from typing import Dict, List, Any, Optional

import certifi
from pymongo import MongoClient, InsertOne, UpdateOne, ASCENDING, HASHED
from pymongo.errors import BulkWriteError


def apply_index(collection, index_def):
    """Create an index with support for single or multi-field definitions."""
    if not index_def:
        return

    index_type = index_def.get("type", "ascending")
    fields = index_def.get("fields")
    field = index_def.get("field")

    # Normalize key list
    if isinstance(fields, list) and len(fields) > 0:
        keys = [(f, ASCENDING) for f in fields]
    elif field:
        keys = [(field, ASCENDING)]
    else:
        print(f"Warning: index definition missing fields: {index_def}")
        return

    options = {}
    if index_def.get("unique"):
        options["unique"] = True

    # Adjust keys for special types
    if index_type == "hashed":
        if len(keys) > 1:
            print(f"Warning: hashed index only supports a single field. Using the first field for {index_def}")
        keys = [(keys[0][0], HASHED)]
    elif index_type == "text":
        if len(keys) > 1:
            print(f"Warning: text index requires a single field. Using the first field for {index_def}")
        keys = [(keys[0][0], "text")]

    collection.create_index(keys, **options)

def parse_args():
    """Parse command line arguments."""
    parser = argparse.ArgumentParser(description="openEHR data denormalizer for MongoDB")
    parser.add_argument("--config", required=True, help="Path to configuration file")
    parser.add_argument("--patient-id", help="Process a specific patient ID only")
    parser.add_argument("--limit", type=int, help="Limit number of patients to process")
    parser.add_argument("--dry-run", action="store_true", help="Don't write to database")
    return parser.parse_args()

def load_config(config_file: str) -> Dict[str, Any]:
    """Load configuration from file."""
    try:
        with open(config_file, "r") as f:
            config = json.load(f)
        return config
    except Exception as e:
        print(f"Error loading config: {e}")
        sys.exit(1)

def get_db_connection(mongo_uri: str):
    """Connect to MongoDB."""
    try:
        client = MongoClient(mongo_uri, tlsCAFile=certifi.where())
        return client
    except Exception as e:
        print(f"Error connecting to MongoDB: {e}")
        sys.exit(1)

def get_value_at_path(doc: Dict[str, Any], path: str) -> Any:
    """Get a value at a specific dot-notation path in a document."""
    parts = path.split(".")
    current = doc
    
    for part in parts:
        # Handle array index notation like items[0]
        if "[" in part and part.endswith("]"):
            field_name, index_str = part.split("[", 1)
            index = int(index_str[:-1])
            
            if field_name not in current or not isinstance(current[field_name], list):
                return None
                
            if index >= len(current[field_name]):
                return None
                
            current = current[field_name][index]
        # Handle array find by archetype like items[openEHR-EHR-SECTION.immunisation_list.v0]
        elif "[" in part and part.endswith("]") and "openEHR-" in part:
            field_name, archetype_str = part.split("[", 1)
            archetype_id = archetype_str[:-1]
            
            if field_name not in current or not isinstance(current[field_name], list):
                return None
                
            found = False
            for item in current[field_name]:
                if item.get("archetype_node_id") == archetype_id:
                    current = item
                    found = True
                    break
                    
            if not found:
                return None
        else:
            if part not in current:
                return None
            current = current[part]
    
    return current

def extract_composition_data(composition: Dict[str, Any], extraction_rules: Dict[str, str]) -> Dict[str, Any]:
    """Extract specific data from a composition based on extraction rules."""
    extracted_data = {}
    
    for target_field, source_path in extraction_rules.items():
        value = get_value_at_path(composition, source_path)
        if value is not None:
            extracted_data[target_field] = value
            
    return extracted_data

def denormalize_single_collection(
    client,
    config: Dict[str, Any],
    patient_id: Optional[str] = None,
    limit: Optional[int] = None,
    dry_run: bool = False
) -> int:
    """
    Implement the single collection denormalization strategy.
    Returns the number of patients processed.
    """
    source_db = client[config["source_db"]]
    target_db = client[config["target_db"]]
    
    comp_collection = source_db[config["compositions_collection"]]
    meta_collection = target_db[config["meta_collection"]]
    
    strategy_config = config.get("strategy_config", {})
    field_mappings = config.get("field_mappings", {})
    preferred_ehr_field = field_mappings.get("ehrIdField")
    comp_id_field = field_mappings.get("compositionIdField", "_id")
    template_field = field_mappings.get("templateIdField", "template_id")

    ehr_fields = []
    for candidate in [preferred_ehr_field, "ehrid", "ehr_id"]:
        if candidate and candidate not in ehr_fields:
            ehr_fields.append(candidate)
    if not ehr_fields:
        ehr_fields = ["ehrid"]

    patient_batch_size = config.get("patient_batch_size", 100)
    
    # Find unique patient IDs across candidate fields
    patient_ids = []
    seen_ids = set()
    for field in ehr_fields:
        pipeline = [
            {"$match": {field: {"$ne": None}}},
            {"$group": {"_id": f"${field}"}},
            {"$sort": {"_id": 1}}
        ]
        
        if patient_id:
            pipeline.insert(0, {"$match": {field: patient_id}})
        
        if limit:
            pipeline.append({"$limit": limit})
            
        for doc in comp_collection.aggregate(pipeline):
            pid = doc.get("_id")
            if pid is None or pid in seen_ids:
                continue
            seen_ids.add(pid)
            patient_ids.append(pid)
    
    print(f"Found {len(patient_ids)} unique patients to process")
    
    # Process patients in batches
    total_patients = 0
    total_documents = 0
    
    for i in range(0, len(patient_ids), patient_batch_size):
        batch = patient_ids[i:i+patient_batch_size]
        print(f"Processing patient batch {i//patient_batch_size + 1} ({len(batch)} patients)")
        
        start_time = time.time()
        
        # For each patient in batch
        for ehrid in batch:
            # Find all compositions for this patient
            ehr_match = {ehr_fields[0]: ehrid} if len(ehr_fields) == 1 else {
                "$or": [{field: ehrid} for field in ehr_fields]
            }
            compositions = list(comp_collection.find(ehr_match))
            
            if not compositions:
                print(f"Warning: No compositions found for patient {ehrid}")
                continue
                
            # Extract and denormalize data based on strategy config
            document_refs = []
            denormalized_data = []
            
            for comp in compositions:
                comp_id = comp.get(comp_id_field, comp.get("_id"))
                document_refs.append({
                    "id": comp_id,
                    "archetype_id": comp.get("archetype_node_id"),
                    "template_id": comp.get(template_field) or comp.get("template_id")
                })
                
                # If denormalization is enabled, extract data
                if strategy_config.get("denormalize", False):
                    extracted = {}
                    
                    # Apply flatten paths if configured
                    if "flatten" in strategy_config:
                        for path in strategy_config["flatten"]:
                            value = get_value_at_path(comp, path)
                            if value is not None:
                                if path not in extracted:
                                    extracted[path] = []
                                extracted[path].append(value)
                    
                    # Apply extraction rules if configured
                    if "extract" in strategy_config:
                        extracted.update(extract_composition_data(comp, strategy_config["extract"]))
                        
                    denormalized_data.append({
                        "comp_id": comp_id,
                        "data": extracted
                    })
            
            # Create metadata document for this patient
            meta_doc = {
                "created": datetime.now(),
                "updated": datetime.now(),
                "document_count": len(compositions),
                "documents": document_refs
            }

            for field in ehr_fields:
                meta_doc[field] = ehrid
            # legacy aliases
            meta_doc.setdefault("ehrid", ehrid)
            meta_doc.setdefault("ehr_id", ehrid)
            
            # Add denormalized data if available
            if denormalized_data:
                meta_doc["denormalized"] = denormalized_data
            
            # Insert or update metadata document
            if not dry_run:
                meta_query = {"$or": [{field: ehrid} for field in set(ehr_fields + ["ehrid", "ehr_id"])]}
                meta_collection.update_one(meta_query, {"$set": meta_doc}, upsert=True)
            
            total_patients += 1
            total_documents += len(compositions)
        
        elapsed = time.time() - start_time
        print(f"Batch completed in {elapsed:.2f} seconds")
        print(f"Processed {len(batch)} patients with {total_documents} documents")
    
    # Create indexes if defined
    if not dry_run and "indexes" in strategy_config:
        for index_def in strategy_config["indexes"]:
            apply_index(meta_collection, index_def)
    
    return total_patients

def denormalize_distributed_collections(
    client,
    config: Dict[str, Any],
    patient_id: Optional[str] = None,
    limit: Optional[int] = None,
    dry_run: bool = False
) -> int:
    """
    Implement the distributed collections denormalization strategy.
    Returns the number of patients processed.
    """
    source_db = client[config["source_db"]]
    target_db = client[config["target_db"]]
    
    comp_collection = source_db[config["compositions_collection"]]
    meta_collection = target_db[config["meta_collection"]]
    
    strategy_config = config.get("strategy_config", {})
    field_mappings = config.get("field_mappings", {})
    preferred_ehr_field = field_mappings.get("ehrIdField")
    comp_id_field = field_mappings.get("compositionIdField", "_id")
    template_field = field_mappings.get("templateIdField", "template_id")
    version_field = field_mappings.get("versionField", "version")

    ehr_fields = []
    for candidate in [preferred_ehr_field, "ehrid", "ehr_id"]:
        if candidate and candidate not in ehr_fields:
            ehr_fields.append(candidate)
    if not ehr_fields:
        ehr_fields = ["ehrid"]
    patient_batch_size = config.get("patient_batch_size", 100)
    
    # Get archetype collection mappings
    archetype_collections = strategy_config.get("archetypeCollections", {})
    transformations = strategy_config.get("transformations", {})
    
    # Ensure all target collections exist
    collection_map = {}
    for archetype, collection_name in archetype_collections.items():
        collection_map[archetype] = target_db[collection_name]
    
    # Find unique patient IDs
    patient_ids = []
    seen_ids = set()
    for field in ehr_fields:
        pipeline = [
            {"$match": {field: {"$ne": None}}},
            {"$group": {"_id": f"${field}"}},
            {"$sort": {"_id": 1}}
        ]
        
        if patient_id:
            pipeline.insert(0, {"$match": {field: patient_id}})
        
        if limit:
            pipeline.append({"$limit": limit})
        
        for doc in comp_collection.aggregate(pipeline):
            pid = doc.get("_id")
            if pid is None or pid in seen_ids:
                continue
            seen_ids.add(pid)
            patient_ids.append(pid)

    print(f"Found {len(patient_ids)} unique patients to process")
    
    # Process patients in batches
    total_patients = 0
    total_documents = 0
    
    for i in range(0, len(patient_ids), patient_batch_size):
        batch = patient_ids[i:i+patient_batch_size]
        print(f"Processing patient batch {i//patient_batch_size + 1} ({len(batch)} patients)")
        
        start_time = time.time()
        
        # For each patient in batch
        for ehrid in batch:
            # Find all compositions for this patient
            ehr_match = {ehr_fields[0]: ehrid} if len(ehr_fields) == 1 else {
                "$or": [{field: ehrid} for field in ehr_fields]
            }
            compositions = list(comp_collection.find(ehr_match))
            
            if not compositions:
                print(f"Warning: No compositions found for patient {ehrid}")
                continue
                
            # Organize compositions by archetype
            archetype_docs = {}
            document_refs = []
            
            for comp in compositions:
                comp_id = comp["_id"]
                archetype_id = comp.get("archetype_node_id")
                document_refs.append({"id": comp_id, "archetype_id": archetype_id})
                
                # Skip if no archetype mapping exists
                if not archetype_id or archetype_id not in archetype_collections:
                    continue
                    
                target_collection = archetype_collections[archetype_id]
                
                # Apply any transformations for this collection
                if target_collection in transformations:
                    transform_config = transformations[target_collection]
                    
                    # Create transformed document
                    transformed_doc = {
                        "_id": comp_id,
                        "archetype_id": archetype_id,
                        "composition_date": comp.get("composition_date") or comp.get(version_field)
                    }
                    for field in ehr_fields:
                        transformed_doc[field] = ehrid
                    transformed_doc.setdefault("ehrid", ehrid)
                    transformed_doc.setdefault("ehr_id", ehrid)
                    
                    # Apply flattening rules
                    if "flatten" in transform_config:
                        flattened = {}
                        for path in transform_config["flatten"]:
                            value = get_value_at_path(comp, path)
                            if value is not None:
                                flattened[path.replace(".", "_")] = value
                        transformed_doc["flattened"] = flattened
                    
                    # Apply extraction rules
                    if "extract" in transform_config:
                        extracted = extract_composition_data(comp, transform_config["extract"])
                        transformed_doc.update(extracted)
                    
                    # Store for bulk insert
                    if target_collection not in archetype_docs:
                        archetype_docs[target_collection] = []
                    archetype_docs[target_collection].append(transformed_doc)
                else:
                    # No transformation, just add the composition with a different ID
                    doc_copy = comp.copy()
                    for field in ehr_fields:
                        doc_copy[field] = ehrid
                    doc_copy.setdefault("ehrid", ehrid)
                    doc_copy.setdefault("ehr_id", ehrid)
                    if target_collection not in archetype_docs:
                        archetype_docs[target_collection] = []
                    archetype_docs[target_collection].append(doc_copy)
            
            # Create metadata document for this patient
            meta_doc = {
                "created": datetime.now(),
                "updated": datetime.now(),
                "document_count": len(compositions),
                "documents": document_refs
            }
            for field in ehr_fields:
                meta_doc[field] = ehrid
            meta_doc.setdefault("ehrid", ehrid)
            meta_doc.setdefault("ehr_id", ehrid)
            
            # Insert documents into target collections
            if not dry_run:
                # Update metadata
                meta_query = {"$or": [{field: ehrid} for field in set(ehr_fields + ["ehrid", "ehr_id"])]}
                meta_collection.update_one(meta_query, {"$set": meta_doc}, upsert=True)
                
                # Insert transformed documents
                for collection_name, docs in archetype_docs.items():
                    if not docs:
                        continue
                        
                    target_collection = target_db[collection_name]
                    operations = [
                        UpdateOne(
                            {"_id": doc["_id"]},
                            {"$set": doc},
                            upsert=True
                        ) for doc in docs
                    ]
                    
                    try:
                        target_collection.bulk_write(operations)
                    except BulkWriteError as bwe:
                        print(f"Bulk write error: {bwe.details}")
            
            total_patients += 1
            total_documents += len(compositions)
        
        elapsed = time.time() - start_time
        print(f"Batch completed in {elapsed:.2f} seconds")
        print(f"Processed {len(batch)} patients with {total_documents} documents")
    
    # Create indexes if defined
    if not dry_run and "indexes" in strategy_config:
        for index_def in strategy_config["indexes"]:
            collection_name = index_def.get("collection")
            if not collection_name:
                print(f"Warning: Index definition missing collection: {index_def}")
                continue
            if collection_name not in target_db.list_collection_names():
                print(f"Warning: Collection {collection_name} doesn't exist, skipping index creation")
                continue
            
            target_collection = target_db[collection_name]
            apply_index(target_collection, index_def)
    
    return total_patients

def main():
    """Main function to run the denormalizer."""
    args = parse_args()
    config = load_config(args.config)
    
    # Connect to MongoDB
    mongo_uri = config.get("mongo_uri") or os.environ.get("MONGO_URI")
    if not mongo_uri:
        print("Error: MongoDB URI not provided in config or environment")
        sys.exit(1)
    
    client = get_db_connection(mongo_uri)
    
    # Validate essential config
    for field in ["source_db", "target_db", "compositions_collection", "meta_collection", "strategy"]:
        if field not in config:
            print(f"Error: Missing required configuration field: {field}")
            sys.exit(1)
    
    # Process data based on strategy
    start_time = time.time()
    strategy = config["strategy"]
    
    print(f"Starting denormalization using '{strategy}' strategy")
    print(f"Source: {config['source_db']}.{config['compositions_collection']}")
    print(f"Target: {config['target_db']}.{config['meta_collection']}")
    
    if args.dry_run:
        print("DRY RUN MODE: No data will be written to the database")
    
    total_patients = 0
    
    try:
        if strategy == "SingleCollection":
            total_patients = denormalize_single_collection(
                client, 
                config, 
                patient_id=args.patient_id, 
                limit=args.limit, 
                dry_run=args.dry_run
            )
        elif strategy == "DistributedCollections":
            total_patients = denormalize_distributed_collections(
                client, 
                config, 
                patient_id=args.patient_id,

                limit=args.limit, 
                dry_run=args.dry_run
            )
        else:
            print(f"Error: Unknown strategy '{strategy}'")
            sys.exit(1)
    except Exception as e:
        print(f"Error during denormalization: {e}")
        sys.exit(1)
    finally:
        client.close()
    
    elapsed = time.time() - start_time
    print(f"Denormalization completed in {elapsed:.2f} seconds")
    print(f"Processed {total_patients} patients")

if __name__ == "__main__":
    main()
