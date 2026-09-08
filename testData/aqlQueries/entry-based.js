SELECT 
   e/ehr_id/value AS ehrId, 
   c/uid/value AS compositionID, 
   a/time AS administrationTime,
   a/other_participations/performer/identifiers/id AS performerId,
   admin/items[at0014]/value/defining_code/code_string AS centre,
   d/items[at0147]/value/defining_code/code_string AS codiViaAdmin, 
   d/items[at0141]/value/defining_code/code_string AS codiLocalitzacio 

FROM EHR e 
CONTAINS COMPOSITION c[openEHR-EHR-COMPOSITION.vaccination_list.v0] 
CONTAINS ACTION a[openEHR-EHR-ACTION.medication.v1] 
CONTAINS CLUSTER admin[openEHR-EHR-CLUSTER.admin_salut.v0]
CONTAINS CLUSTER d[at0140]

WHERE 
   a/time >= '2024-12-23' 
   AND a/time <= '2024-12-24' 
   AND admin/items[at0014]/value/defining_code/code_string = 'H08002103' 
   AND a/other_participations/performer/identifiers/id = '12345678Z' 

LIMIT 100;