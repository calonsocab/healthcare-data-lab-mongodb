import { requireAuthenticatedUser } from '@/lib/security/api';
import { NextResponse } from 'next/server';

// Smart pattern matching for healthcare data structure requests
const FIELD_PATTERNS = {
  // Patient/Demographics
  'patient.*id|identifier': { name: 'Patient ID', attribute: 'patientId', dataType: 'string', required: true },
  'patient.*name|name.*patient': { name: 'Patient Name', attribute: 'patientName', dataType: 'string', required: true },
  'birth.*date|date.*birth|dob': { name: 'Date of Birth', attribute: 'dateOfBirth', dataType: 'date', required: true },
  'gender|sex': { name: 'Gender', attribute: 'gender', dataType: 'code', required: false },
  'age': { name: 'Age', attribute: 'age', dataType: 'number', required: false },
  'phone|telephone|mobile': { name: 'Phone Number', attribute: 'phoneNumber', dataType: 'string', required: false },
  'email|e-mail': { name: 'Email', attribute: 'email', dataType: 'string', required: false },
  'address': { name: 'Address', attribute: 'address', dataType: 'object', required: false },
  'street': { name: 'Street', attribute: 'street', dataType: 'string', required: false },
  'city': { name: 'City', attribute: 'city', dataType: 'string', required: false },
  'postal.*code|zip': { name: 'Postal Code', attribute: 'postalCode', dataType: 'string', required: false },
  'country': { name: 'Country', attribute: 'country', dataType: 'code', required: false },

  // Clinical
  'allergy|allergies': { name: 'Allergy', attribute: 'allergy', dataType: 'object', required: false, repeatable: true },
  'allergen': { name: 'Allergen', attribute: 'allergen', dataType: 'string', required: true },
  'severity': { name: 'Severity', attribute: 'severity', dataType: 'code', required: false },
  'reaction': { name: 'Reaction', attribute: 'reaction', dataType: 'string', required: false },
  'onset|start.*date': { name: 'Onset Date', attribute: 'onsetDate', dataType: 'date', required: false },
  'status': { name: 'Status', attribute: 'status', dataType: 'code', required: false },
  'notes|comment': { name: 'Clinical Notes', attribute: 'clinicalNotes', dataType: 'string', required: false },

  // Vital Signs
  'blood.*pressure|bp': { name: 'Blood Pressure', attribute: 'bloodPressure', dataType: 'object', required: false },
  'systolic': { name: 'Systolic', attribute: 'systolic', dataType: 'number', required: true },
  'diastolic': { name: 'Diastolic', attribute: 'diastolic', dataType: 'number', required: true },
  'temperature|temp': { name: 'Temperature', attribute: 'temperature', dataType: 'quantity', required: false },
  'heart.*rate|pulse': { name: 'Heart Rate', attribute: 'heartRate', dataType: 'number', required: false },
  'weight': { name: 'Weight', attribute: 'weight', dataType: 'quantity', required: false },
  'height': { name: 'Height', attribute: 'height', dataType: 'quantity', required: false },
  'bmi': { name: 'BMI', attribute: 'bmi', dataType: 'number', required: false },

  // Laboratory
  'lab.*result|test.*result': { name: 'Lab Result', attribute: 'labResult', dataType: 'object', required: false, repeatable: true },
  'analyte|test.*name': { name: 'Analyte Name', attribute: 'analyteName', dataType: 'string', required: true },
  'result.*value|value': { name: 'Result Value', attribute: 'resultValue', dataType: 'quantity', required: true },
  'unit': { name: 'Unit', attribute: 'unit', dataType: 'string', required: true },
  'reference.*range': { name: 'Reference Range', attribute: 'referenceRange', dataType: 'string', required: false },
  'interpretation': { name: 'Interpretation', attribute: 'interpretation', dataType: 'code', required: false },

  // Medication
  'medication|drug|medicine': { name: 'Medication', attribute: 'medication', dataType: 'object', required: false, repeatable: true },
  'dose|dosage': { name: 'Dose', attribute: 'dose', dataType: 'quantity', required: true },
  'frequency': { name: 'Frequency', attribute: 'frequency', dataType: 'string', required: true },
  'route': { name: 'Route', attribute: 'route', dataType: 'code', required: false },
  'start.*date': { name: 'Start Date', attribute: 'startDate', dataType: 'date', required: false },
  'end.*date': { name: 'End Date', attribute: 'endDate', dataType: 'date', required: false },

  // Common
  'timestamp|datetime|recorded': { name: 'Timestamp', attribute: 'timestamp', dataType: 'date', required: false },
  'recorded.*by|author': { name: 'Recorded By', attribute: 'recordedBy', dataType: 'string', required: false },
  'description|desc': { name: 'Description', attribute: 'description', dataType: 'string', required: false },
  'code': { name: 'Code', attribute: 'code', dataType: 'code', required: false },
  'category': { name: 'Category', attribute: 'category', dataType: 'code', required: false }
};

// Parse user message and generate nodes
function parseUserRequest(message, nodes) {
  const lowerMessage = message.toLowerCase();
  const nodesToAdd = [];
  const actions = [];

  // Find root node
  const rootNode = nodes.find(n => n.parentNodeId === null);
  const parentId = rootNode?.nodeId || null;

  // Check for "make repeatable" or "make array" patterns
  if (lowerMessage.includes('repeatable') || lowerMessage.includes('array') || lowerMessage.includes('multiple')) {
    // Find which field to make repeatable
    for (const node of nodes) {
      const nameMatch = lowerMessage.includes(node.name.toLowerCase()) ||
                       lowerMessage.includes(node.attribute.toLowerCase());
      if (nameMatch && node.parentNodeId !== null) {
        return {
          message: `I've made the "${node.name}" field repeatable (0..*). This allows multiple instances of this field.`,
          nodesToAdd: [],
          nodesToUpdate: [{
            nodeId: node.nodeId,
            changes: { occurrences: { min: 0, max: '*' } }
          }],
          actions: [`Made ${node.name} repeatable`]
        };
      }
    }
  }

  // Check for "add" patterns
  if (lowerMessage.includes('add')) {
    // Try to match field patterns
    for (const [pattern, fieldDef] of Object.entries(FIELD_PATTERNS)) {
      const regex = new RegExp(pattern, 'i');
      if (regex.test(lowerMessage)) {
        // Check if field already exists
        const exists = nodes.some(n =>
          n.attribute.toLowerCase() === fieldDef.attribute.toLowerCase()
        );

        if (!exists) {
          const newNode = {
            nodeId: `node-${Math.random().toString(36).substr(2, 9)}`,
            name: fieldDef.name,
            attribute: fieldDef.attribute,
            dataType: fieldDef.dataType,
            parentNodeId: parentId,
            occurrences: fieldDef.repeatable
              ? { min: 0, max: '*' }
              : { min: fieldDef.required ? 1 : 0, max: 1 },
            childrenNodeIds: [],
            canonicalPath: ''
          };

          nodesToAdd.push(newNode);
          actions.push(`Added ${fieldDef.name} field`);
        }
      }
    }
  }

  // Check for "contact" which adds multiple fields
  if (lowerMessage.includes('contact')) {
    const contactFields = [
      { name: 'Phone Number', attribute: 'phoneNumber', dataType: 'string' },
      { name: 'Email', attribute: 'email', dataType: 'string' },
      { name: 'Address', attribute: 'address', dataType: 'object' }
    ];

    contactFields.forEach(field => {
      if (!nodes.some(n => n.attribute === field.attribute)) {
        nodesToAdd.push({
          nodeId: `node-${Math.random().toString(36).substr(2, 9)}`,
          name: field.name,
          attribute: field.attribute,
          dataType: field.dataType,
          parentNodeId: parentId,
          occurrences: { min: 0, max: 1 },
          childrenNodeIds: [],
          canonicalPath: ''
        });
        actions.push(`Added ${field.name}`);
      }
    });
  }

  // Generate response message
  let responseMessage;
  if (nodesToAdd.length > 0) {
    responseMessage = `I've added ${nodesToAdd.length} field(s) to your structure: ${actions.join(', ')}.`;
  } else if (actions.length === 0) {
    responseMessage = `I understood your request but couldn't find specific fields to add. Try phrases like:
- "Add patient name and date of birth"
- "Add allergy information"
- "Add contact details"
- "Make the address repeatable"
- "Add blood pressure with systolic and diastolic"`;
  } else {
    responseMessage = actions.join('. ') + '.';
  }

  return {
    message: responseMessage,
    nodesToAdd,
    nodesToUpdate: [],
    actions
  };
}

export async function POST(request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const session = auth.session;

    const { message, definitionName, currentStructure, nodes } = await request.json();

    if (!message) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    // Parse user request and generate suggestions
    const result = parseUserRequest(message, nodes || []);

    // Ensure nodes have proper structure
    if (result.nodesToAdd && Array.isArray(result.nodesToAdd)) {
      result.nodesToAdd = result.nodesToAdd.map(node => ({
        ...node,
        nodeId: node.nodeId || `node-${Math.random().toString(36).substr(2, 9)}`,
        childrenNodeIds: node.childrenNodeIds || [],
        canonicalPath: node.canonicalPath || '',
        occurrences: node.occurrences || { min: 0, max: 1 }
      }));
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('AI assist error:', error);

    return NextResponse.json({
      message: `I encountered an error processing your request. Try being more specific, like "add a phone number field" or "add patient age".`,
      nodesToAdd: [],
      nodesToUpdate: [],
      actions: []
    });
  }
}
