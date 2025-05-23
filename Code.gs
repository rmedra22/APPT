/**
 * @OnlyCurrentDoc
 */

// Function to check and create sheets if they don't exist
function checkOrCreateSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheetsConfig = [
      {
        name: 'Personal Details',
        headers: ['Name', 'Date', 'Agent ID', 'State', 'NPN', 'Number', 'Email', 'Children', 'Exam Date', 'Record ID']
      },
      {
        name: 'System Progressions',
        headers: [
          'Code Number', 'Client', 'Pass License', 'Business Partner Plan', 'Licensed Appointed',
          'Field Trainings 10', 'Associate Promotion', 'Net License', 'Complete Laser Fund',
          'CFT In Progress', 'Certified Field Trainer', 'Elite Trainer', 'Marketing Director',
          'Watch 50000', 'Ring 100000', 'Executive Marketing Director', 'Record ID'
        ]
      },
      {
        name: 'Dreams List',
        headers: ['Time Frame', 'Dream', 'Why', 'Record ID']
      },
      {
        name: 'Expenses to Income Report',
        headers: ['Item', 'Amount', 'Category', 'Date', 'Description', 'Agent', 'Record ID']
      },
      {
        name: 'Potential Business Partners',
        headers: ['Name', 'Contact', 'Email', 'Status', 'Notes', 'Agent', 'Record ID']
      },
      {
        name: 'Potential Field Trainings',
        headers: ['Agent', 'Client Name', 'Date', 'Type of Training', 'Outcome', 'Notes', 'Record ID']
      },
      {
        name: 'Agents', // Sheet for user login credentials and roles
        headers: ['agentName', 'password', 'avatarUrl', 'lastUpdated', 'role']
      },
      {
        name: 'Raw Form', // A generic sheet for raw data if needed
        headers: ['Timestamp', 'Form Name', 'Agent', 'Data']
      }
    ];

    sheetsConfig.forEach(config => {
      let sheet = ss.getSheetByName(config.name);
      if (!sheet) {
        // Only create the sheet if it doesn't exist
        sheet = ss.insertSheet(config.name);
        // Set headers only for new sheets
        sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
        sheet.autoResizeColumns(1, config.headers.length);
        Logger.log(`Created new sheet: ${config.name} with headers: ${config.headers.join(', ')}`);
      } else {
        Logger.log(`Sheet already exists: ${config.name}. Verifying headers.`);
        const currentHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        // Special handling for Dreams List to update its structure if it has the old headers
        if (config.name === 'Dreams List') {
          // Check for old Dreams List headers
          if (currentHeaders[0] === 'Dream Name' && currentHeaders[1] === 'Target Date' && currentHeaders[2] === 'Estimated Cost') {
            Logger.log('Migrating Dreams List headers and data.');
            // Create a new header row with the correct structure
            sheet.getRange(1, 1, 1, config.headers.length).setValues([config.headers]);
            // If there's data, we need to migrate it
            if (sheet.getLastRow() > 1) {
              const data = sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues();
              const newData = data.map(row => {
                return [
                  '', // Time Frame (new column)
                  row[0], // Dream Name (old Dream Name)
                  '', // Why (new column)
                  row[3] || '' // Record ID
                ];
              });
              // Clear existing data
              if (sheet.getLastRow() > 1) {
                sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
              }
              // Write the migrated data
              if (newData.length > 0) {
                sheet.getRange(2, 1, newData.length, config.headers.length).setValues(newData);
              }
              Logger.log('Dreams List data migrated.');
            }
          }
        }
        
        // Add any missing headers to existing sheets
        const missingHeaders = config.headers.filter(h => !currentHeaders.includes(h));
        if (missingHeaders.length > 0) {
          let lastAddedColumn = sheet.getLastColumn();
          missingHeaders.forEach(header => {
            lastAddedColumn++;
            sheet.getRange(1, lastAddedColumn).setValue(header);
            Logger.log(`Added missing header to ${config.name}: ${header}`);
          });
          sheet.autoResizeColumns(1, lastAddedColumn);
        }
      }
    });
    return { status: 'success', message: 'Sheets verified and updated without data loss' };
  } catch (error) {
    Logger.log('Error in checkOrCreateSheets: %s', error.toString());
    return { status: 'error', message: 'Error checking sheets: ' + error.toString() };
  }
}

// Helper function for JSONP responses
function jsonpResponse(data, callback) {
  if (callback) {
    return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  try {
    const callback = e.parameter.callback;

    if (e.parameter.action === 'login') {
      const agentName = e.parameter.agent;
      const password = e.parameter.password;
      const result = verifyLogin(agentName, password);
      return jsonpResponse(result, callback);
    }

    if (e.parameter.action === 'getAgentInfo') {
        const agentName = e.parameter.agent;
        const result = getAgentInfo(agentName);
        return jsonpResponse(result, callback);
    }

    if (e.parameter.action === 'getFormData') {
      return getFormData(e);
    }
    
    if (e.parameter.init) {
      // This will be triggered by your frontend's initSheets() call.
      // It calls checkOrCreateSheets to set up all necessary tabs and headers.
      const result = checkOrCreateSheets();
      return jsonpResponse(result, callback);
    }
    
    // Default response if no action is specified
    return jsonpResponse({ status: 'error', message: 'No action specified' }, callback);
  } catch (error) {
    Logger.log('Error in doGet: %s', error.toString());
    return jsonpResponse({ status: 'error', message: 'Server error: ' + error.toString() }, e.parameter.callback);
  }
}

function doPost(e) {
  try {
    let data;
    if (e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No data provided' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const sheetName = data.sheetName;
    const action = data.action; // Get the action from the request

    if (!sheetName && action !== 'bulkUpdateEntries') { // For bulkUpdateEntries, sheetName might be implied or passed differently
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing sheetName' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Handle bulk updates for multi-entry forms
    if (action === 'bulkUpdateEntries') {
        return handleBulkUpdateEntries(data);
    }

    // Existing logic for single-entry forms
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found: ' + sheetName }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'No headers found' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const idColumnIndex = headers.findIndex(header => 
      header.toLowerCase() === 'record id' || 
      header.toLowerCase() === 'record_id');
    
    if (idColumnIndex < 0) {
      // If no Record ID column exists, add it
      sheet.getRange(1, lastColumn + 1).setValue('Record ID');
      headers.push('Record ID');
    }
    
    let existingRowIndex = -1;
    if (data.record_id) { // Use data.record_id from frontend (snake_case)
      const recordIdColIndex = headers.findIndex(header => 
        header.toLowerCase() === 'record id' || 
        header.toLowerCase() === 'record_id');
      if (recordIdColIndex >= 0) {
        // Adjusted range to ensure it doesn't fail on empty sheets or only headers
        const dataRange = sheet.getLastRow() > 1 ? sheet.getRange(2, recordIdColIndex + 1, sheet.getLastRow() - 1, 1) : null;
        if (dataRange) {
          const values = dataRange.getValues();
          for (let i = 0; i < values.length; i++) {
            if (values[i][0] == data.record_id) { // Use data.record_id
              existingRowIndex = i + 2; // +2 because we start at row 2 and i is 0-based
              break;
            }
          }
        }
      }
    }

    const rowData = headers.map(header => {
      const key = header.toLowerCase().replace(/ /g, '_');
      if ((header === 'Record ID' || header.toLowerCase() === 'record_id')) {
        return data.record_id || ''; // Ensure record_id is picked up
      }
      return data.fields[key] !== undefined ? data.fields[key] : ''; // Access fields from the 'fields' object
    });
    
    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('Updated existing row at index: ' + existingRowIndex);
    } else {
      sheet.appendRow(rowData);
      Logger.log('Appended new row with data: ' + JSON.stringify(rowData));
    }
    
    Logger.log('Data saved successfully to sheet: ' + sheetName);
    Logger.log('Row data: ' + JSON.stringify(rowData));

    return ContentService.createTextOutput(JSON.stringify({ 
      status: 'success', 
      message: existingRowIndex > 0 ? 'Data updated successfully' : 'Data saved successfully' 
    })).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doPost: %s', error.toString());
    return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Server error: ' + error.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

// --- Login & Authentication Functions ---
function verifyLogin(agentName, password) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const agentSheet = ss.getSheetByName('Agents');
  if (!agentSheet) {
    return { error: 'Agents sheet not found.' };
  }

  const dataRange = agentSheet.getDataRange();
  const values = dataRange.getValues();
  const headers = values[0];
  const agentNameColIndex = headers.indexOf('agentName');
  const passwordColIndex = headers.indexOf('password');
  const avatarUrlColIndex = headers.indexOf('avatarUrl');
  const roleColIndex = headers.indexOf('role');

  if (agentNameColIndex === -1 || passwordColIndex === -1 || roleColIndex === -1) {
    return { error: 'Required columns (agentName, password, role) not found in Agents sheet.' };
  }

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    if (row[agentNameColIndex] == agentName && row[passwordColIndex] == password) {
      return { 
        agentName: agentName, 
        role: row[roleColIndex] || 'user', // Default to 'user' if role is empty
        avatarUrl: row[avatarUrlColIndex] || '' 
      };
    }
  }
  return { error: 'Invalid agent name or password.' };
}

function getAgentInfo(agentName) {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const agentSheet = ss.getSheetByName('Agents');
    if (!agentSheet) {
        return { error: 'Agents sheet not found.' };
    }

    const dataRange = agentSheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    const agentNameColIndex = headers.indexOf('agentName');
    const avatarUrlColIndex = headers.indexOf('avatarUrl');
    const roleColIndex = headers.indexOf('role');

    if (agentNameColIndex === -1 || roleColIndex === -1) {
        return { error: 'Required columns (agentName, role) not found in Agents sheet.' };
    }

    for (let i = 1; i < values.length; i++) {
        const row = values[i];
        if (row[agentNameColIndex] == agentName) {
            return {
                agentName: agentName,
                role: row[roleColIndex] || 'user',
                avatarUrl: row[avatarUrlColIndex] || ''
            };
        }
    }
    return { error: 'Agent not found.' };
}


// --- Data Retrieval for Forms (getFormData) ---
function getFormData(e) {
  try {
    const sheetName = e.parameter.sheetName;
    const sessionId = e.parameter.sessionId; // This is the agentName in our current setup
    const callback = e.parameter.callback;

    if (!sheetName) {
      return jsonpResponse({ status: 'error', message: 'Missing sheetName' }, callback);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      return jsonpResponse({ status: 'error', message: 'Sheet not found: ' + sheetName }, callback);
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      return jsonpResponse({ status: 'error', message: 'No headers found' }, callback);
    }

    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    
    // Determine if it's a multi-entry form (where we need all entries for a given agent)
    const isMultiEntryForm = ['Dreams List', 'Expenses to Income Report', 'Potential Business Partners', 'Potential Field Trainings'].includes(sheetName);

    let formData = {};

    if (sheet.getLastRow() > 1) { // Check if there's any data beyond headers
      const dataRange = sheet.getRange(2, 1, sheet.getLastRow() - 1, lastColumn);
      const values = dataRange.getValues();

      if (isMultiEntryForm) {
        const matchingEntries = [];
        const agentColumnIndex = headers.indexOf('Agent'); // Assuming multi-entry forms have an 'Agent' column to link to session ID
        
        // Ensure that the 'Agent' column exists for multi-entry forms
        if (agentColumnIndex === -1 && sheetName !== 'Raw Form') { // Raw Form is generic and doesn't need 'Agent' column
            Logger.log(`Warning: Multi-entry sheet '${sheetName}' does not have an 'Agent' column.`);
            // Continue as if no agent filter if column is missing
        }

        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          // If 'Agent' column exists and matches sessionId, or if it's Raw Form, include the entry
          if ((agentColumnIndex !== -1 && row[agentColumnIndex] == sessionId) || sheetName === 'Raw Form') {
            const entryData = {};
            headers.forEach((header, index) => {
              const key = header.replace(/ /g, '_').toLowerCase();
              entryData[key] = row[index] !== undefined ? row[index] : '';
            });
            matchingEntries.push(entryData);
          }
        }
        formData = { entries: matchingEntries }; // Return as an array of entries
      } else {
        // Single-entry form: find the record that matches the sessionId (Agent Name)
        const recordIdColumnIndex = headers.indexOf('Record ID');
        
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          // For single entry forms, the 'Record ID' is expected to be `agentName_formId_timestamp_random`
          // We need to match the start of the Record ID with the agentName
          if (recordIdColumnIndex !== -1 && row[recordIdColumnIndex] && String(row[recordIdColumnIndex]).startsWith(sessionId + '_')) {
            headers.forEach((header, index) => {
              const key = header.replace(/ /g, '_').toLowerCase();
              formData[key] = row[index] !== undefined ? row[index] : '';
            });
            break; // Found the record for this agent, stop
          }
        }
      }
    }
    
    // If no data was found for single-entry forms, formData will be empty.
    // The frontend handles generating a new Record ID in this case.
    // For multi-entry, formData.entries will be an empty array if no matches.
    return jsonpResponse({ status: 'success', formData: formData }, callback);
  } catch (error) {
    Logger.log('Error in getFormData: %s', error.toString());
    return jsonpResponse({ status: 'error', message: 'Server error: ' + error.toString() }, e.parameter.callback);
  }
}

// --- Multi-Entry Form Handling (handleBulkUpdateEntries) ---
function handleBulkUpdateEntries(data) {
    const agent = data.agent; // Agent name for filtering
    const entries = data.entries; // Array of entry objects
    const formId = data.formId; // e.g., 'expensesForm', 'dreamsForm'
    const sheetName = getSheetNameFromFormId(formId);

    if (!agent || !entries || !sheetName) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Missing agent, entries, or sheetName for bulk update' }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: 'Sheet not found: ' + sheetName }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    const recordIdColIndex = headers.indexOf('Record ID');
    const agentColIndex = headers.indexOf('Agent');

    if (recordIdColIndex === -1 || agentColIndex === -1) {
        return ContentService.createTextOutput(JSON.stringify({ status: 'error', message: `Required columns (Record ID, Agent) not found in ${sheetName} sheet.` }))
            .setMimeType(ContentService.MimeType.JSON);
    }

    const existingData = sheet.getLastRow() > 1 ? sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues() : [];
    const updatedRows = [];
    const newRows = [];
    const recordIdsToKeep = new Set(); // To track which records should remain in the sheet

    entries.forEach(entry => {
        const recordId = entry.record_id;
        recordIdsToKeep.add(recordId); // Mark this record ID as one to keep

        const rowData = headers.map(header => {
            const key = header.replace(/ /g, '_').toLowerCase();
            if (key === 'record_id') return recordId;
            if (key === 'agent') return agent; // Ensure agent name is saved with the entry
            return entry[key] !== undefined ? entry[key] : '';
        });

        let found = false;
        for (let i = 0; i < existingData.length; i++) {
            if (existingData[i][recordIdColIndex] === recordId) {
                updatedRows.push({ rowIndex: i + 2, data: rowData }); // +2 for 1-based row index and header row
                found = true;
                break;
            }
        }
        if (!found) {
            newRows.push(rowData);
        }
    });

    // Perform updates
    updatedRows.forEach(rowInfo => {
        sheet.getRange(rowInfo.rowIndex, 1, 1, rowInfo.data.length).setValues([rowInfo.data]);
    });

    // Perform new row appends
    if (newRows.length > 0) {
        sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, newRows[0].length).setValues(newRows);
    }

    // Delete rows that are no longer in the submitted entries for the current agent
    // Iterate backwards to avoid issues with shifting row indices during deletion
    for (let i = existingData.length - 1; i >= 0; i--) {
        const existingRecordId = existingData[i][recordIdColIndex];
        const existingAgent = existingData[i][agentColIndex];

        // Only consider deleting records belonging to the current agent
        if (existingAgent == agent && !recordIdsToKeep.has(existingRecordId)) {
            sheet.deleteRow(i + 2); // +2 for 1-based row index and header row
            Logger.log(`Deleted row ${i + 2} with Record ID: ${existingRecordId} for agent: ${agent}`);
        }
    }

    Logger.log(`Bulk update for ${sheetName} completed. Updated: ${updatedRows.length}, New: ${newRows.length}, Deleted: (count from log above) for agent ${agent}.`);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success', message: 'Bulk data updated successfully' }))
        .setMimeType(ContentService.MimeType.JSON);
}


// Helper function to map formId to sheetName for the new bulk update
function getSheetNameFromFormId(formId) {
    const map = {
        'expensesForm': 'Expenses to Income Report',
        'dreamsForm': 'Dreams List',
        'partnersForm': 'Potential Business Partners',
        'clientsForm': 'Potential Field Trainings'
    };
    return map[formId];
}