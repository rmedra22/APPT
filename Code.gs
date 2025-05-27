/**
 * @OnlyCurrentDoc
 */

// Function to check and create sheets if they don't exist
function checkOrCreateSheets() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheets = ss.getSheets();
    const sheetNames = sheets.map(sheet => sheet.getName());
    
    // Define all required sheets and their headers
    const requiredSheets = {
      'Personal Details': ['record_id', 'agent', 'name', 'date', 'agent_id', 'state', 'npn', 'number', 'email', 'children', 'exam_date'],
      'System Progressions': ['record_id', 'agent', 'code_number', 'client', 'pass_license', 'business_partner_plan', 'licensed_appointed', 'field_trainings_10', 'associate_promotion', 'net_license', 'complete_laser_fund', 'cft_in_progress', 'certified_field_trainer', 'elite_trainer', 'marketing_director', 'watch_50000', 'ring_100000', 'executive_marketing_director'],
      'Dreams List': ['record_id', 'agent', 'time_frame', 'dream', 'why'],
      'Expenses to Income Report': ['record_id', 'agent', 'item', 'amount', 'category', 'date', 'description'],
      'Potential Business Partners': ['record_id', 'agent', 'name', 'contact', 'email', 'status', 'notes'],
      'Potential Field Trainings': ['record_id', 'agent', 'client_name', 'date', 'type_of_training', 'outcome', 'notes'],
      'Agents': ['agentName', 'password', 'role', 'lastUpdated', 'avatarUrl']
    };
    
    // Create any missing sheets and add headers
    let sheetsCreated = 0;
    for (const [sheetName, headers] of Object.entries(requiredSheets)) {
      if (!sheetNames.includes(sheetName)) {
        const newSheet = ss.insertSheet(sheetName);
        newSheet.appendRow(headers);
        sheetsCreated++;
        
        // If it's the Agents sheet and it's new, add a default admin user
        if (sheetName === 'Agents') {
          newSheet.appendRow(['admin', 'admin123', 'admin', new Date().toISOString(), '']);
        }
      } else {
        // Check if headers match and update if needed
        const sheet = ss.getSheetByName(sheetName);
        const existingHeaders = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        // If headers don't match or are missing, update them
        if (existingHeaders.length < headers.length) {
          sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        }
      }
    }
    
    return { 
      status: 'success', 
      message: sheetsCreated > 0 ? `Created ${sheetsCreated} new sheets.` : 'All required sheets already exist.' 
    };
  } catch (error) {
    Logger.log('Error in checkOrCreateSheets: %s', error.toString());
    return { status: 'error', message: 'Error creating sheets: ' + error.toString() };
  }
}

// Helper function for JSONP responses
function jsonpResponse(data, callback) {
  if (!callback) {
    return ContentService.createTextOutput(JSON.stringify(data))
      .setMimeType(ContentService.MimeType.JSON);
  }
  
  return ContentService.createTextOutput(callback + '(' + JSON.stringify(data) + ');')
    .setMimeType(ContentService.MimeType.JAVASCRIPT);
}

function doGet(e) {
  try {
    const action = e.parameter.action;
    const callback = e.parameter.callback;
    
    // Handle initialization request
    if (e.parameter.init === 'true') {
      return initializeSheets(e);
    }
    
    // Handle admin check request
    if (action === 'checkAdmin') {
      const result = checkAndFixAdminUser();
      return ContentService.createTextOutput(
        callback + '(' + JSON.stringify(result) + ');'
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    // Handle login request
    if (action === 'login') {
      return handleLogin(e);
    }
    
    // Handle form data retrieval
    if (action === 'getFormData') {
      return getFormData(e);
    }
    
    // Handle user management actions
    if (action === 'getUsers') {
      return getUsers(e);
    }
    
    // Handle getting all personal details for admin
    if (action === 'getAllPersonalDetails') {
      const result = getAllPersonalDetails();
      Logger.log('getAllPersonalDetails result: ' + JSON.stringify(result));
      return ContentService.createTextOutput(
        callback + '(' + JSON.stringify(result) + ');'
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    // Handle saving data via GET request (for JSONP)
    if (action === 'saveData') {
      return handleSaveDataGet(e);
    }
    
    // Default response
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ status: 'error', message: 'Unknown action' }) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    
  } catch (error) {
    Logger.log('Error in doGet: %s', error.toString());
    const callback = e.parameter.callback || 'callback';
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify({ status: 'error', message: 'Server error: ' + error.toString() }) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
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

    Logger.log('Received POST data: ' + JSON.stringify(data));
    
    // Get callback parameter if it exists
    const callback = e.parameter.callback;

    const action = data.action; // Get the action from the request
    
    // Handle bulk updates for multi-entry forms
    if (action === 'bulkUpdateEntries') {
        const result = handleBulkUpdateEntries(data);
        if (callback) {
          return ContentService.createTextOutput(callback + '(' + JSON.stringify(result) + ')')
            .setMimeType(ContentService.MimeType.JAVASCRIPT);
        }
        return result;
    }

    const sheetName = data.sheetName;
    if (!sheetName) {
      const errorResponse = { status: 'error', message: 'Missing sheetName' };
      if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }

    // Existing logic for single-entry forms
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
      const errorResponse = { status: 'error', message: 'Sheet not found: ' + sheetName };
      if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(JSON.stringify(errorResponse))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const lastColumn = sheet.getLastColumn();
    if (lastColumn === 0) {
      const errorResponse = { status: 'error', message: 'No headers found' };
      if (callback) {
        return ContentService.createTextOutput(callback + '(' + JSON.stringify(errorResponse) + ')')
          .setMimeType(ContentService.MimeType.JAVASCRIPT);
      }
      return ContentService.createTextOutput(JSON.stringify(errorResponse))
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

    // Special handling for System Progressions
    if (sheetName === 'System Progressions') {
      Logger.log('Special handling for System Progressions');
      Logger.log('Fields from client: ' + JSON.stringify(data.fields));
      
      // Ensure agentName is included
      if (data.fields.agentName) {
        Logger.log('agentName found in fields: ' + data.fields.agentName);
      } else if (data.fields.agent) {
        Logger.log('agent found in fields, copying to agentName: ' + data.fields.agent);
        data.fields.agentName = data.fields.agent;
      } else {
        Logger.log('No agent or agentName found in fields');
      }
      
      // Convert boolean values to true/false strings for Google Sheets
      for (const key in data.fields) {
        if (typeof data.fields[key] === 'boolean') {
          data.fields[key] = data.fields[key] ? true : false;
          Logger.log(`Converted boolean field ${key} to ${data.fields[key]}`);
        }
      }
    }

    const rowData = headers.map(header => {
      const key = header.toLowerCase().replace(/ /g, '_');
      if ((header === 'Record ID' || header.toLowerCase() === 'record_id')) {
        return data.record_id || ''; // Ensure record_id is picked up
      }
      
      // Special case for agentName in System Progressions
      if (sheetName === 'System Progressions' && header === 'agentName') {
        return data.fields.agentName || data.fields.agent || '';
      }
      
      return data.fields[key] !== undefined ? data.fields[key] : ''; // Access fields from the 'fields' object
    });
    
    Logger.log('Row data to be saved: ' + JSON.stringify(rowData));
    
    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('Updated existing row at index: ' + existingRowIndex);
    } else {
      sheet.appendRow(rowData);
      Logger.log('Appended new row with data: ' + JSON.stringify(rowData));
    }
    
    Logger.log('Data saved successfully to sheet: ' + sheetName);

    const successResponse = { 
      status: 'success', 
      message: existingRowIndex > 0 ? 'Data updated successfully' : 'Data saved successfully' 
    };
    
    if (callback) {
      return ContentService.createTextOutput(callback + '(' + JSON.stringify(successResponse) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService.createTextOutput(JSON.stringify(successResponse))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    Logger.log('Error in doPost: %s', error.toString());
    const errorResponse = { status: 'error', message: 'Server error: ' + error.toString() };
    
    if (e.parameter.callback) {
      return ContentService.createTextOutput(e.parameter.callback + '(' + JSON.stringify(errorResponse) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    return ContentService.createTextOutput(JSON.stringify(errorResponse))
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

  if (agentNameColIndex === -1 || passwordColIndex === -1) {
    return { error: 'Required columns (agentName, password) not found in Agents sheet.' };
  }

  Logger.log('Verifying login for agent: ' + agentName);
  Logger.log('Headers: ' + JSON.stringify(headers));
  Logger.log('agentNameColIndex: ' + agentNameColIndex + ', passwordColIndex: ' + passwordColIndex + ', roleColIndex: ' + roleColIndex);

  for (let i = 1; i < values.length; i++) {
    const row = values[i];
    Logger.log('Checking row ' + i + ': ' + JSON.stringify(row));
    
    if (row[agentNameColIndex] == agentName && row[passwordColIndex] == password) {
      let role = 'user'; // Default role
      
      if (roleColIndex !== -1 && row[roleColIndex]) {
        role = String(row[roleColIndex]).toLowerCase(); // Convert to string and lowercase
      }
      
      Logger.log('Login successful for agent: ' + agentName + ' with role: ' + role);
      
      // For admin user, explicitly set role to 'admin'
      if (agentName === 'admin' || role === 'admin') {
        role = 'admin';
        Logger.log('Setting explicit admin role for user: ' + agentName);
      }
      
      return { 
        agentName: agentName, 
        role: role,
        avatarUrl: avatarUrlColIndex !== -1 ? row[avatarUrlColIndex] || '' : '' 
      };
    }
  }
  
  Logger.log('Login failed for agent: ' + agentName);
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
    const sessionId = e.parameter.sessionId || e.parameter.agent; // Accept both sessionId and agent parameters
    const callback = e.parameter.callback;

    Logger.log(`getFormData called with sheetName=${sheetName}, sessionId/agent=${sessionId}`);

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
    Logger.log(`Headers found: ${headers.join(', ')}`);
    
    // Determine if it's a multi-entry form (where we need all entries for a given agent)
    const isMultiEntryForm = ['Dreams List', 'Expenses to Income Report', 'Potential Business Partners', 'Potential Field Trainings'].includes(sheetName);
    Logger.log(`Is multi-entry form: ${isMultiEntryForm}`);

    let formData = {};
    
    // Find the column indices for 'Agent' and 'Record ID'
    const agentColumnIndex = headers.findIndex(header => 
      header.toLowerCase() === 'agent' || 
      header.toLowerCase() === 'agentname');
    
    const recordIdColumnIndex = headers.findIndex(header => 
      header.toLowerCase() === 'record id' || 
      header.toLowerCase() === 'record_id');
    
    Logger.log(`Agent column index: ${agentColumnIndex}, Record ID column index: ${recordIdColumnIndex}`);
    
    // Special debug for System Progressions
    if (sheetName === 'System Progressions') {
      Logger.log('Special debug for System Progressions');
      Logger.log(`Looking for data for agent: ${sessionId}`);
      Logger.log(`Headers: ${headers.join(', ')}`);
    }
    
    // Get all data from the sheet
    const lastRow = sheet.getLastRow();
    if (lastRow > 1) {
      const values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
      Logger.log(`Found ${values.length} data rows`);
      
      if (isMultiEntryForm) {
        // Multi-entry form: return all entries for this agent
        const matchingEntries = [];
        
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          // If 'Agent' column exists and matches sessionId, include the entry
          if (agentColumnIndex !== -1 && row[agentColumnIndex] == sessionId) {
            const entryData = {};
            headers.forEach((header, index) => {
              const key = header.replace(/ /g, '_').toLowerCase();
              entryData[key] = row[index] !== undefined ? row[index] : '';
            });
            matchingEntries.push(entryData);
            Logger.log(`Found matching entry for agent ${sessionId}: ${JSON.stringify(entryData)}`);
          }
        }
        
        Logger.log(`Total matching entries found: ${matchingEntries.length}`);
        return jsonpResponse({ entries: matchingEntries }, callback);
      } else {
        // Single-entry form: find the record that matches the sessionId (Agent Name)
        // For single-entry forms, we now use a consistent record_id format: agentName_formId
        const formId = getFormIdFromSheetName(sheetName);
        const expectedRecordIdPrefix = `${sessionId}_${formId}`;
        
        Logger.log(`Looking for record with ID prefix: ${expectedRecordIdPrefix}`);
        
        let found = false;
        for (let i = 0; i < values.length; i++) {
          const row = values[i];
          
          // First try to match by record_id
          if (recordIdColumnIndex !== -1 && row[recordIdColumnIndex]) {
            const recordId = String(row[recordIdColumnIndex]);
            if (recordId === expectedRecordIdPrefix || recordId.startsWith(`${sessionId}_${formId}`)) {
              headers.forEach((header, index) => {
                const key = header.replace(/ /g, '_').toLowerCase();
                formData[key] = row[index] !== undefined ? row[index] : '';
              });
              found = true;
              Logger.log(`Found matching record for agent ${sessionId} with record_id ${recordId}`);
              break; // Found the record for this agent, stop
            }
          }
          
          // If no match by record_id, try matching by agent name
          if (!found && agentColumnIndex !== -1 && row[agentColumnIndex] == sessionId) {
            headers.forEach((header, index) => {
              const key = header.replace(/ /g, '_').toLowerCase();
              formData[key] = row[index] !== undefined ? row[index] : '';
            });
            found = true;
            Logger.log(`Found matching record for agent ${sessionId} by agent name`);
            break;
          }
        }
        
        if (!found) {
          Logger.log(`No matching record found for agent ${sessionId} in ${sheetName}`);
        } else {
          Logger.log(`Returning data: ${JSON.stringify(formData)}`);
        }
        
        return jsonpResponse(formData, callback);
      }
    } else {
      Logger.log(`No data found in sheet ${sheetName} beyond headers`);
      return jsonpResponse(isMultiEntryForm ? { entries: [] } : {}, callback);
    }
  } catch (error) {
    Logger.log(`Error in getFormData: ${error.toString()}`);
    return jsonpResponse({ status: 'error', message: 'Server error: ' + error.toString() }, e.parameter.callback);
  }
}

// --- Multi-Entry Form Handling (handleBulkUpdateEntries) ---
function handleBulkUpdateEntries(data) {
    try {
        const agent = data.agent; // Agent name for filtering
        const entries = data.entries; // Array of entry objects
        const formId = data.formId; // e.g., 'expensesForm', 'dreamsForm'
        const sheetName = getSheetNameFromFormId(formId);

        Logger.log(`Handling bulk update for ${formId} (${sheetName}) with ${entries.length} entries for agent ${agent}`);

        if (!agent || !entries || !sheetName) {
            return ContentService.createTextOutput(JSON.stringify({ 
                status: 'error', 
                message: 'Missing agent, entries, or sheetName for bulk update' 
            })).setMimeType(ContentService.MimeType.JSON);
        }

        const ss = SpreadsheetApp.getActiveSpreadsheet();
        const sheet = ss.getSheetByName(sheetName);
        if (!sheet) {
            return ContentService.createTextOutput(JSON.stringify({ 
                status: 'error', 
                message: 'Sheet not found: ' + sheetName 
            })).setMimeType(ContentService.MimeType.JSON);
        }

        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        
        // Find the record_id column index
        const recordIdColIndex = headers.findIndex(header => 
            header.toLowerCase() === 'record id' || 
            header.toLowerCase() === 'record_id');
            
        // Find the agent column index
        const agentColIndex = headers.findIndex(header => 
            header.toLowerCase() === 'agent' || 
            header.toLowerCase() === 'agentname');

        if (recordIdColIndex === -1) {
            // If no Record ID column exists, add it
            sheet.getRange(1, headers.length + 1).setValue('Record ID');
            headers.push('Record ID');
        }
        
        if (agentColIndex === -1) {
            // If no Agent column exists, add it
            sheet.getRange(1, headers.length + 1).setValue('Agent');
            headers.push('Agent');
        }

        const existingData = sheet.getLastRow() > 1 ? 
            sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).getValues() : [];
        
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
            Logger.log(`Updated row ${rowInfo.rowIndex} with data: ${JSON.stringify(rowInfo.data)}`);
        });

        // Perform new row appends
        if (newRows.length > 0) {
            sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, headers.length).setValues(newRows);
            Logger.log(`Added ${newRows.length} new rows`);
        }

        // Delete rows that are no longer in the submitted entries for the current agent
        // Iterate backwards to avoid issues with shifting row indices during deletion
        let deletedCount = 0;
        for (let i = existingData.length - 1; i >= 0; i--) {
            const existingRecordId = existingData[i][recordIdColIndex];
            const existingAgent = existingData[i][agentColIndex];

            // Only consider deleting records belonging to the current agent
            if (existingAgent == agent && !recordIdsToKeep.has(existingRecordId)) {
                sheet.deleteRow(i + 2); // +2 for 1-based row index and header row
                deletedCount++;
                Logger.log(`Deleted row ${i + 2} with Record ID: ${existingRecordId} for agent: ${agent}`);
            }
        }

        Logger.log(`Bulk update for ${sheetName} completed. Updated: ${updatedRows.length}, New: ${newRows.length}, Deleted: ${deletedCount} for agent ${agent}.`);
        
        return ContentService.createTextOutput(JSON.stringify({ 
            status: 'success', 
            message: 'Bulk data updated successfully',
            updated: updatedRows.length,
            added: newRows.length,
            deleted: deletedCount
        })).setMimeType(ContentService.MimeType.JSON);
    } catch (error) {
        Logger.log('Error in handleBulkUpdateEntries: %s', error.toString());
        return ContentService.createTextOutput(JSON.stringify({ 
            status: 'error', 
            message: 'Server error: ' + error.toString() 
        })).setMimeType(ContentService.MimeType.JSON);
    }
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

// Helper function to get formId from sheetName
function getFormIdFromSheetName(sheetName) {
  const map = {
    'Personal Details': 'personalForm',
    'System Progressions': 'progressionsForm',
    'Dreams List': 'dreamsForm',
    'Expenses to Income Report': 'expensesForm',
    'Potential Business Partners': 'partnersForm',
    'Potential Field Trainings': 'clientsForm'
  };
  return map[sheetName] || '';
}

// Get all personal details for admin view
function getAllPersonalDetails() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Personal Details');
    if (!sheet) {
      Logger.log('Personal Details sheet not found');
      return { status: 'error', message: 'Personal Details sheet not found' };
    }
    
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    
    Logger.log(`Personal Details sheet has ${lastRow} rows and ${lastColumn} columns`);
    
    if (lastRow <= 1) { // Only headers, no data
      Logger.log('No data found in Personal Details sheet (only headers)');
      return { status: 'success', entries: [] };
    }
    
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    Logger.log('Headers: ' + JSON.stringify(headers));
    
    const data = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    Logger.log(`Retrieved ${data.length} rows of data`);
    
    const entries = data.map(row => {
      const entry = {};
      headers.forEach((header, index) => {
        const key = header.toLowerCase().replace(/ /g, '_');
        entry[key] = row[index];
      });
      return entry;
    });
    
    Logger.log(`Processed ${entries.length} entries`);
    return { status: 'success', entries: entries };
  } catch (error) {
    Logger.log('Error in getAllPersonalDetails: %s', error.toString());
    return { status: 'error', message: 'Error getting personal details: ' + error.toString() };
  }
}

// Direct function to get personal details for a specific agent
function getAgentPersonalDetails(agentName) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName('Personal Details');
    if (!sheet) {
      return { error: 'Personal Details sheet not found' };
    }
    
    const lastRow = sheet.getLastRow();
    const lastColumn = sheet.getLastColumn();
    
    if (lastRow <= 1) { // Only headers, no data
      return { error: 'No personal details found' };
    }
    
    const headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const data = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    
    // Find the agent column index
    const agentColIndex = headers.findIndex(header => 
      header.toLowerCase() === 'agent' || 
      header.toLowerCase() === 'agentname');
    
    if (agentColIndex === -1) {
      return { error: 'Agent column not found in Personal Details sheet' };
    }
    
    // Find the row for the specified agent
    for (let i = 0; i < data.length; i++) {
      if (data[i][agentColIndex] === agentName) {
        const entry = {};
        headers.forEach((header, index) => {
          const key = header.toLowerCase().replace(/ /g, '_');
          entry[key] = data[i][index];
        });
        return entry;
      }
    }
    
    return { error: 'No personal details found for agent: ' + agentName };
  } catch (error) {
    Logger.log('Error in getAgentPersonalDetails: %s', error.toString());
    return { error: 'Error getting agent personal details: ' + error.toString() };
  }
}

// Function to initialize sheets
function initializeSheets(e) {
  try {
    const result = checkOrCreateSheets();
    return ContentService.createTextOutput(
      e.parameter.callback + '(' + JSON.stringify(result) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (error) {
    Logger.log('Error in initializeSheets: %s', error.toString());
    return ContentService.createTextOutput(
      e.parameter.callback + '(' + JSON.stringify({ status: 'error', message: 'Server error: ' + error.toString() }) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

// Handle login request
function handleLogin(e) {
  try {
    const agentName = e.parameter.agent;
    const password = e.parameter.password;
    const callback = e.parameter.callback;
    
    Logger.log('handleLogin called for agent: ' + agentName);
    
    if (!agentName || !password) {
      return ContentService.createTextOutput(
        callback + '(' + JSON.stringify({ error: 'Agent name and password are required.' }) + ');'
      ).setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    
    const result = verifyLogin(agentName, password);
    Logger.log('Login result: ' + JSON.stringify(result));
    
    return ContentService.createTextOutput(
      callback + '(' + JSON.stringify(result) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  } catch (error) {
    Logger.log('Error in handleLogin: %s', error.toString());
    return ContentService.createTextOutput(
      e.parameter.callback + '(' + JSON.stringify({ error: 'Server error: ' + error.toString() }) + ');'
    ).setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
}

// New function to handle saving data via GET request (for JSONP)
function handleSaveDataGet(e) {
  try {
    const callback = e.parameter.callback;
    const sheetName = e.parameter.sheetName;
    const recordId = e.parameter.record_id;
    const agentName = e.parameter.agentName || e.parameter.agent;
    let fields = {};
    
    // Parse the data parameter if it exists
    if (e.parameter.data) {
      try {
        fields = JSON.parse(e.parameter.data);
      } catch (parseError) {
        Logger.log('Error parsing data parameter: ' + parseError.toString());
        // Continue with empty fields object
      }
    }
    
    // Add all other parameters as fields
    for (const key in e.parameter) {
      if (['callback', 'action', 'sheetName', 'record_id'].indexOf(key) === -1) {
        fields[key] = e.parameter[key];
      }
    }
    
    Logger.log('handleSaveDataGet called with sheetName=' + sheetName + ', recordId=' + recordId + ', agentName=' + agentName);
    Logger.log('Fields: ' + JSON.stringify(fields));
    
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
    
    // Find the record ID column
    const idColumnIndex = headers.findIndex(header => 
      header.toLowerCase() === 'record id' || 
      header.toLowerCase() === 'record_id');
    
    if (idColumnIndex < 0) {
      // If no Record ID column exists, add it
      sheet.getRange(1, lastColumn + 1).setValue('Record ID');
      headers.push('Record ID');
    }
    
    // Find existing row if record_id is provided
    let existingRowIndex = -1;
    if (recordId) {
      const recordIdColIndex = headers.findIndex(header => 
        header.toLowerCase() === 'record id' || 
        header.toLowerCase() === 'record_id');
      if (recordIdColIndex >= 0) {
        const dataRange = sheet.getLastRow() > 1 ? sheet.getRange(2, recordIdColIndex + 1, sheet.getLastRow() - 1, 1) : null;
        if (dataRange) {
          const values = dataRange.getValues();
          for (let i = 0; i < values.length; i++) {
            if (values[i][0] == recordId) {
              existingRowIndex = i + 2; // +2 because we start at row 2 and i is 0-based
              break;
            }
          }
        }
      }
    }
    
    // Special handling for System Progressions
    if (sheetName === 'System Progressions') {
      Logger.log('Special handling for System Progressions');
      
      // Ensure agentName is included
      if (agentName) {
        Logger.log('agentName found in parameters: ' + agentName);
        fields['agentName'] = agentName;
        fields['agent'] = agentName;
      }
    }
    
    // Prepare row data
    const rowData = headers.map(header => {
      const key = header.toLowerCase().replace(/ /g, '_');
      
      if ((header === 'Record ID' || header.toLowerCase() === 'record_id')) {
        return recordId || '';
      }
      
      // Special case for agentName in System Progressions
      if (sheetName === 'System Progressions' && header === 'agentName') {
        return agentName || fields['agentName'] || fields['agent'] || '';
      }
      
      return fields[key] !== undefined ? fields[key] : '';
    });
    
    Logger.log('Row data to be saved: ' + JSON.stringify(rowData));
    
    if (existingRowIndex > 0) {
      sheet.getRange(existingRowIndex, 1, 1, rowData.length).setValues([rowData]);
      Logger.log('Updated existing row at index: ' + existingRowIndex);
    } else {
      sheet.appendRow(rowData);
      Logger.log('Appended new row with data: ' + JSON.stringify(rowData));
    }
    
    Logger.log('Data saved successfully to sheet: ' + sheetName);
    
    return jsonpResponse({ 
      status: 'success', 
      message: existingRowIndex > 0 ? 'Data updated successfully' : 'Data saved successfully' 
    }, callback);
  } catch (error) {
    Logger.log('Error in handleSaveDataGet: %s', error.toString());
    return jsonpResponse({ status: 'error', message: 'Server error: ' + error.toString() }, e.parameter.callback);
  }
}

// Function to check and fix admin user in Agents sheet
function checkAndFixAdminUser() {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const agentSheet = ss.getSheetByName('Agents');
    if (!agentSheet) {
      Logger.log('Agents sheet not found');
      return { status: 'error', message: 'Agents sheet not found' };
    }
    
    const dataRange = agentSheet.getDataRange();
    const values = dataRange.getValues();
    const headers = values[0];
    const agentNameColIndex = headers.indexOf('agentName');
    const roleColIndex = headers.indexOf('role');
    
    if (agentNameColIndex === -1 || roleColIndex === -1) {
      Logger.log('Required columns not found in Agents sheet');
      return { status: 'error', message: 'Required columns not found in Agents sheet' };
    }
    
    let adminFound = false;
    let adminRowIndex = -1;
    
    // Check if admin user exists and has correct role
    for (let i = 1; i < values.length; i++) {
      const row = values[i];
      if (row[agentNameColIndex] === 'admin') {
        adminFound = true;
        adminRowIndex = i + 1; // +1 because sheet rows are 1-indexed
        
        // Check if admin role is correct
        if (row[roleColIndex] !== 'admin') {
          // Fix admin role
          agentSheet.getRange(adminRowIndex, roleColIndex + 1).setValue('admin');
          Logger.log('Fixed admin role for admin user');
        }
        
        break;
      }
    }
    
    // If admin user doesn't exist, create it
    if (!adminFound) {
      const newRow = Array(headers.length).fill('');
      newRow[agentNameColIndex] = 'admin';
      newRow[roleColIndex] = 'admin';
      newRow[headers.indexOf('password')] = 'admin123';
      newRow[headers.indexOf('lastUpdated')] = new Date().toISOString();
      
      agentSheet.appendRow(newRow);
      Logger.log('Created admin user');
    }
    
    return { status: 'success', message: 'Admin user checked and fixed if needed' };
  } catch (error) {
    Logger.log('Error in checkAndFixAdminUser: %s', error.toString());
    return { status: 'error', message: 'Error checking admin user: ' + error.toString() };
  }
}

// Function to get all users (for admin)
function getUsers(e) {
  try {
    const callback = e.parameter.callback;
    
    // Check if Agents sheet exists
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const agentSheet = ss.getSheetByName('Agents');
    if (!agentSheet) {
      return jsonpResponse({ status: 'error', message: 'Agents sheet not found' }, callback);
    }
    
    const lastRow = agentSheet.getLastRow();
    const lastColumn = agentSheet.getLastColumn();
    
    if (lastRow <= 1) { // Only headers, no data
      return jsonpResponse({ status: 'success', users: [] }, callback);
    }
    
    const headers = agentSheet.getRange(1, 1, 1, lastColumn).getValues()[0];
    const data = agentSheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
    
    const users = data.map(row => {
      const user = {};
      headers.forEach((header, index) => {
        // Skip password field for security
        if (header !== 'password') {
          user[header] = row[index];
        }
      });
      return user;
    });
    
    Logger.log(`Retrieved ${users.length} users`);
    return jsonpResponse({ status: 'success', users: users }, callback);
  } catch (error) {
    Logger.log('Error in getUsers: %s', error.toString());
    return jsonpResponse({ status: 'error', message: 'Error getting users: ' + error.toString() }, callback);
  }
}
