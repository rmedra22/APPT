// Global variables
let currentPage = 'dashboard'; // Default to dashboard
let currentAgent = null; // Stores logged-in agent info
const AUTO_SAVE_DELAY = 2000; // 2 seconds
let autoSaveTimeout = null;
let autoSaveEnabled = true; // New variable to control auto-save feature

// Add role-based access control
function setupRoleBasedAccess() {
  if (!currentAgent || !currentAgent.role) {
    console.error('Cannot setup role-based access: No current agent or role information');
    return;
  }
  
  console.log('Setting up role-based access for role:', currentAgent.role);
  // Force lowercase comparison for consistency
  const isAdmin = currentAgent.role.toLowerCase() === 'admin';
  
  // Debug: Log current agent info
  console.log('Current agent:', JSON.stringify(currentAgent));
  console.log('Is admin?', isAdmin);
  
  // Show/hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(element => {
    if (isAdmin) {
      element.style.display = 'block';
      console.log('Showing admin-only element:', element);
    } else {
      element.style.display = 'none';
      console.log('Hiding admin-only element:', element);
    }
  });
  
  // Show/hide sidebar menu items based on role
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    const page = link.getAttribute('data-page');
    console.log('Checking sidebar link:', page, 'for role:', currentAgent.role);
    
    // Make all links visible first
    link.style.display = '';
    
    // For regular users, only hide user-management
    if (!isAdmin) {
      if (page === 'user-management') {
        link.style.display = 'none';
        console.log('Hiding sidebar link:', page);
      } else {
        console.log('Showing sidebar link for regular user:', page);
      }
    } else {
      console.log('Showing sidebar link for admin:', page);
    }
  });
  
  // Debug: Log all sidebar links and their visibility
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    console.log('Sidebar link:', link.getAttribute('data-page'), 'Display:', link.style.display);
  });
}

// Function to toggle auto-save
function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  showToast(autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled', 'info');
  
  // Update UI to show current state
  const toggleButtons = document.querySelectorAll('.auto-save-toggle');
  toggleButtons.forEach(btn => {
    btn.textContent = autoSaveEnabled ? 'Disable Auto-Save' : 'Enable Auto-Save';
  });
}

// !!! IMPORTANT: REPLACE 'YOUR_DEPLOYMENT_ID_HERE' with your actual Google Apps Script Web App Deployment ID
const scriptId = 'AKfycbxsY5P4Qg54N_BoHzKRu0bEyFeBUkg06TRqaxIB45figk5BpbW4uX3Wu8RettDM6FMT6g'; // Replace with your actual script ID

const formSheetMap = {
  'personalForm': 'Personal Details',
  'progressionsForm': 'System Progressions',
  'dreamsForm': 'Dreams List',
  'expensesForm': 'Expenses to Income Report',
  'partnersForm': 'Potential Business Partners',
  'clientsForm': 'Potential Field Trainings'
};

// UI Helper Functions
function showToast(message, type = 'info') {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = message;
  toast.className = 'toast show ' + type;
  setTimeout(() => {
    toast.className = 'toast';
  }, 3000);
}

// Remove these functions entirely
// function showLoading() {
//   document.getElementById('loadingOverlay').classList.add('show');
// }

// function hideLoading() {
//   document.getElementById('loadingOverlay').classList.remove('show');
// }

function updateSaveStatus(message, statusElementId) {
  const statusEl = document.getElementById(statusElementId);
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.opacity = '1';
  // Optional: Add a class for styling (e.g., text-green-500, text-red-500)
  // statusEl.classList.add('text-green-500'); // Example
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    statusEl.style.opacity = '0';
    // statusEl.classList.remove('text-green-500'); // Example
  }, 3000);
}

// Function to generate a unique Record ID
function generateRecordId(agentName, formId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 8); // A short random string
  return `${agentName}_${formId}_${timestamp}_${random}`;
}

// Function to format currency (Peso)
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) {
      return '';
  }
  return '₱' + parseFloat(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Function to parse currency back to number
function parseCurrency(value) {
  if (!value) return null;
  const num = parseFloat(value.replace(/₱|,/g, ''));
  return isNaN(num) ? null : num;
}

// Function to set up currency input (for Expenses amount)
function setupCurrencyInput(inputElement) {
  inputElement.addEventListener('focus', function() {
    this.value = parseCurrency(this.value) || ''; // Remove formatting when focused
  });

  inputElement.addEventListener('blur', function() {
    this.value = formatCurrency(parseCurrency(this.value)); // Add formatting when blurred
  });

  // Initial format if there's a value
  if (inputElement.value) {
    inputElement.value = formatCurrency(parseCurrency(inputElement.value));
  }
}

// Sheet creation function for initial setup
function initSheets() {
  console.log('Initializing sheets...');
  const callbackName = 'handleInitSheetsResponse';
  window[callbackName] = function(response) {
    console.log('Init Sheets Response:', response);
    if (response.status === 'success') {
      showToast('System initialized successfully!', 'success');
    } else {
      showToast('Error initializing system: ' + response.message, 'error');
    }
  };

  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&init=true`;
  document.head.appendChild(script);
}

// Handle Page Navigation
function navigateTo(pageId) {
  console.log(`Attempting to navigate to: ${pageId}`);
  
  // Handle special case for dashboard
  if (pageId === 'dashboard') {
    pageId = 'dashboardPageContent';
  }
  
  // Fix double -form suffix issue
  if (pageId.endsWith('-form-form')) {
    pageId = pageId.replace('-form-form', '-form');
    console.log(`Fixed double form suffix, now navigating to: ${pageId}`);
  }
  
  // Map sidebar data-page values to actual page IDs
  const pageIdMap = {
    'personal-details': 'personal-details-form',
    'system-progressions': 'system-progressions-form',
    'dreams-list': 'dreams-list-form',
    'expenses-to-income-report': 'expenses-to-income-report-form',
    'potential-business-partners': 'potential-business-partners-form',
    'potential-field-trainings': 'potential-field-trainings-form',
    'user-management': 'user-management-form'
  };
  
  // Check if we need to map the pageId
  if (pageIdMap[pageId]) {
    console.log(`Mapping page ID from ${pageId} to ${pageIdMap[pageId]}`);
    pageId = pageIdMap[pageId];
  }
  
  // First, check if the page exists
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.error(`Error: Page with ID "${pageId}" not found`);
    console.log('Available page IDs:');
    document.querySelectorAll('.page-content').forEach(page => {
      console.log(`- ${page.id}`);
    });
    showToast(`Error: Page not found (${pageId})`, 'error');
    return; // Exit the function if the page doesn't exist
  }

  console.log(`Found target page: ${pageId}`);

  // Hide all pages and show the target page
  const pages = document.querySelectorAll('.page-content');
  pages.forEach(page => {
    page.classList.add('hidden');
    console.log(`Hidden page: ${page.id}`);
  });
  
  targetPage.classList.remove('hidden');
  console.log(`Showing page: ${pageId}`);

  // Load data for specific forms when navigating to them
  if (pageId === 'system-progressions-form') {
    console.log('Loading progressions data for newly navigated page');
    setupProgressionsForm();
  }
  
  // If navigating to personal details, load the current user's personal details
  if (pageId === 'personal-details-form') {
    console.log('Loading personal details for current user');
    setTimeout(() => {
      loadPersonalDetails(); // Load the current user's personal details
    }, 100);
    
    // If user is admin, also load all personal details
    if (currentAgent && currentAgent.role === 'admin') {
      console.log('Admin navigated to personal details, loading all personal details');
      setTimeout(() => {
        loadAllPersonalDetails(); // Delay slightly to ensure page is ready
      }, 200);
    }
  }
  
  // If navigating to user management and user is admin, load users list
  if (pageId === 'user-management-form' && currentAgent && currentAgent.role === 'admin') {
    loadUsers();
  }
  
  // Update sidebar active link
  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  sidebarLinks.forEach(link => link.classList.remove('active'));
  
  // Find and activate the corresponding sidebar link
  const sidebarPageIdMap = {
    'dashboardPageContent': 'dashboard',
    'personal-details-form': 'personal-details',
    'system-progressions-form': 'system-progressions',
    'dreams-list-form': 'dreams-list',
    'expenses-to-income-report-form': 'expenses-to-income-report',
    'potential-business-partners-form': 'potential-business-partners',
    'potential-field-trainings-form': 'potential-field-trainings',
    'user-management-form': 'user-management'
  };
  
  const sidebarPageId = sidebarPageIdMap[pageId];
  if (sidebarPageId) {
    const activeLink = document.querySelector(`.sidebar-menu a[data-page="${sidebarPageId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      console.log(`Set active sidebar link: ${sidebarPageId}`);
    }
  }
  
  currentPage = pageId; // Update current page global variable
  console.log(`Successfully navigated to: ${pageId}`);
}

// --- Form Data Handling ---

// Function to save progressions form
function saveProgressionsForm() {
  const form = document.getElementById('progressionsForm');
  if (!form) {
    console.error('Progressions form not found');
    return;
  }
  
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
    return;
  }
  
  const saveStatusElementId = 'progressionsFormSaveStatus';
  
  // Show immediate feedback
  showToast('Saving progressions...', 'info');
  updateSaveStatus('Saving...', saveStatusElementId);
  
  // Get all form data
  const formData = new FormData(form);
  const recordIdInput = form.querySelector('input[name="record_id"]');
  let recordId = recordIdInput ? recordIdInput.value : '';
  
  // If no record_id, create one
  if (!recordId) {
    recordId = `${currentAgent.agentName}_progressionsForm`;
    if (recordIdInput) {
      recordIdInput.value = recordId;
    }
  }
  
  // Convert FormData to a regular object
  const fields = {};
  for (let [key, value] of formData.entries()) {
    fields[key] = value;
  }
  
  // For checkboxes that aren't checked, they won't be in formData
  // So we need to add them with a value of 'false'
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    if (!formData.has(checkbox.name)) {
      fields[checkbox.name] = false;
    } else {
      // Ensure checked checkboxes have value 'true'
      fields[checkbox.name] = true;
    }
  });
  
  // CRITICAL: Add agent name to the data - IMPORTANT: Use 'agentName' to match the column name in the sheet
  fields['agentName'] = currentAgent.agentName;
  fields['agent'] = currentAgent.agentName; // Also include 'agent' for compatibility
  
  console.log('Agent name being saved:', currentAgent.agentName);
  console.log('Fields object:', fields);
  
  const payload = {
    action: 'saveData',
    sheetName: 'System Progressions',
    record_id: recordId,
    fields: fields
  };
  
  console.log('Saving progressions with payload:', payload);
  
  // Create a unique callback name to avoid conflicts
  const callbackName = 'handleSaveProgressionsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Save progressions response:', response);
    showToast('Progressions saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    
    // Reload the data after a short delay to ensure it's updated
    setTimeout(() => {
      loadProgressionsData();
    }, 1000);
  };
  
  // Use JSONP approach with script tag
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=saveData&sheetName=System%20Progressions&record_id=${encodeURIComponent(recordId)}&agentName=${encodeURIComponent(currentAgent.agentName)}&agent=${encodeURIComponent(currentAgent.agentName)}&data=${encodeURIComponent(JSON.stringify(fields))}`;
  
  // Add error handling
  script.onerror = function() {
    console.error('Failed to save progressions - script loading error');
    showToast('Error saving progressions. Please try again.', 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
  };
  
  document.head.appendChild(script);
}

// Add a hidden input field for agentName to the progressions form
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener for progressions form
  const progressionsForm = document.getElementById('progressionsForm');
  if (progressionsForm) {
    // Add a hidden input for agentName if it doesn't exist
    if (!progressionsForm.querySelector('input[name="agentName"]')) {
      const agentNameInput = document.createElement('input');
      agentNameInput.type = 'hidden';
      agentNameInput.name = 'agentName';
      agentNameInput.id = 'progressionsAgentName';
      progressionsForm.appendChild(agentNameInput);
    }
    
    // Add a hidden input for record_id if it doesn't exist
    if (!progressionsForm.querySelector('input[name="record_id"]')) {
      const recordIdInput = document.createElement('input');
      recordIdInput.type = 'hidden';
      recordIdInput.name = 'record_id';
      recordIdInput.id = 'progressionsRecordId';
      progressionsForm.appendChild(recordIdInput);
    }
    
    progressionsForm.addEventListener('submit', function(event) {
      event.preventDefault();
      
      // Update the hidden agentName field before saving
      const agentNameInput = progressionsForm.querySelector('input[name="agentName"]');
      if (agentNameInput && currentAgent && currentAgent.agentName) {
        agentNameInput.value = currentAgent.agentName;
        console.log('Set agentName input value to:', agentNameInput.value);
      }
      
      saveProgressionsForm();
    });
  }
  
  // Add refresh button for progressions form
  const progressionsPage = document.getElementById('system-progressions-form');
  if (progressionsPage) {
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'btn btn-secondary mb-4';
    refreshButton.textContent = 'Refresh Data';
    refreshButton.onclick = function() {
      loadProgressionsData();
    };
    
    // Insert after the page description
    const pageDescription = progressionsPage.querySelector('.page-description');
    if (pageDescription && pageDescription.parentNode) {
      pageDescription.parentNode.insertBefore(refreshButton, pageDescription.nextSibling);
    }
  }
});

// Improve System Progressions form handling
function loadProgressionsData() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('No current agent found');
    showToast('Please log in to view your system progressions', 'error');
    return;
  }
  
  console.log('Loading system progressions for', currentAgent.agentName);
  
  // Show loading status
  const statusElement = document.getElementById('progressionsFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  // Create a unique callback name to avoid conflicts
  const callbackName = 'handleGetProgressionsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('System Progressions Response:', response);
    console.log('Response type:', typeof response);
    console.log('Response keys:', response ? Object.keys(response) : 'null');
    
    if (response && !response.error) {
      // Populate the form with the data
      populateProgressionsForm(response);
      if (statusElement) {
        statusElement.textContent = 'Data loaded!';
        setTimeout(() => {
          statusElement.style.opacity = '0';
        }, 3000);
      }
    } else {
      console.error('Error loading system progressions:', response ? response.error : 'Unknown error');
      if (statusElement) {
        statusElement.textContent = 'Error loading data';
      }
      
      // Make sure record_id is set even if no data was found
      const recordIdInput = document.getElementById('progressionsRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_progressionsForm`;
      }
    }
    
    // Clean up the callback
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=System%20Progressions&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  console.log('Loading system progressions with URL:', url);
  script.src = url;
  
  // Add error handling
  script.onerror = function() {
    console.error('Failed to load system progressions - script loading error');
    if (statusElement) {
      statusElement.textContent = 'Error loading data: Network error';
    }
  };
  
  document.head.appendChild(script);
}

// Special function to populate progressions form with checkboxes
function populateProgressionsForm(data) {
  console.log('Populating progressions form with data:', data);
  const form = document.getElementById('progressionsForm');
  if (!form) {
    console.error('Progressions form not found');
    return;
  }

  // Set the record_id
  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    if (data.record_id) {
      recordIdInput.value = data.record_id;
    } else if (currentAgent) {
      // If no record_id in data, create one
      recordIdInput.value = `${currentAgent.agentName}_progressionsForm`;
    }
  }
  
  // Loop through all checkboxes and set their state based on data
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    const fieldName = checkbox.name;
    // Check if the data contains this field
    if (data[fieldName] !== undefined) {
      // Set checkbox checked state based on value (true/false, Yes/No, or 1/0)
      const value = data[fieldName];
      if (typeof value === 'boolean') {
        checkbox.checked = value;
      } else if (typeof value === 'string') {
        checkbox.checked = value.toLowerCase() === 'true' || 
                          value.toLowerCase() === 'yes' || 
                          value === '1';
      } else if (typeof value === 'number') {
        checkbox.checked = value === 1;
      } else {
        checkbox.checked = false;
      }
      console.log(`Set checkbox ${fieldName} to ${checkbox.checked} based on value: ${value} (${typeof value})`);
    } else {
      // Default to unchecked if no data
      checkbox.checked = false;
      console.log(`No data for checkbox ${fieldName}, setting to unchecked`);
    }
  });
  
  // Also handle any text inputs or other field types
  const textInputs = form.querySelectorAll('input[type="text"], textarea, select');
  textInputs.forEach(input => {
    const fieldName = input.name;
    if (data[fieldName] !== undefined) {
      input.value = data[fieldName];
      console.log(`Set input ${fieldName} to ${input.value}`);
    }
  });
}

// Update the saveFormData function to use JSONP instead of fetch
function saveFormData(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
    return;
  }

  // For System Progressions, use the dedicated function
  if (formId === 'progressionsForm') {
    saveProgressionsForm();
    return;
  }

  const form = document.getElementById(formId);
  const sheetName = formSheetMap[formId];
  const saveStatusElementId = `${formId}SaveStatus`;
  
  if (!sheetName) {
    showToast('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  // Show immediate feedback
  showToast('Saving data...', 'info');
  updateSaveStatus('Saving...', saveStatusElementId);

  const formData = new FormData(form);
  const recordIdInput = form.querySelector('input[name="record_id"]');
  let recordId = recordIdInput ? recordIdInput.value : '';

  // For single-entry forms like personalForm and progressionsForm,
  // we want to use a consistent record_id format for each agent
  // so we can update the same row instead of creating new ones
  if (!recordId && ['personalForm', 'progressionsForm'].includes(formId)) {
    recordId = `${currentAgent.agentName}_${formId}`;
    if (recordIdInput) {
      recordIdInput.value = recordId; // Update the form's hidden input
    }
  }

  // If still no record_id, generate one
  if (!recordId) {
    recordId = generateRecordId(currentAgent.agentName, formId);
    if (recordIdInput) {
      recordIdInput.value = recordId;
    }
  }

  // Convert FormData to a regular object
  const fields = {};
  for (let [key, value] of formData.entries()) {
    fields[key] = value;
  }

  // For checkboxes that aren't checked, they won't be in formData
  // So we need to add them with a value of 'No'
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    if (!formData.has(checkbox.name)) {
      fields[checkbox.name] = 'No';
    }
  });

  // Add agent name to the data
  fields['agent'] = currentAgent.agentName; // Ensure agent name is always saved
  
  // For System Progressions, also add agentName field to match the column name in the sheet
  if (sheetName === 'System Progressions') {
    fields['agentName'] = currentAgent.agentName;
  }

  const payload = {
    action: 'saveData', // This action is handled by doPost in Code.gs
    sheetName: sheetName,
    record_id: recordId,
    fields: fields
  };

  console.log('Saving data with payload:', payload);

  // Use JSONP approach with a form submission
  const jsonpCallback = 'handleSaveFormResponse_' + new Date().getTime();
  window[jsonpCallback] = function(response) {
    console.log('Save form response:', response);
    showToast('Data saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    
    // For single-entry forms, reload the data to ensure UI is updated
    if (!['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
      loadFormData(formId);
    }
  };
  
  // Create a hidden form and submit it
  const hiddenForm = document.createElement('form');
  hiddenForm.method = 'POST';
  hiddenForm.action = `https://script.google.com/macros/s/${scriptId}/exec?callback=${jsonpCallback}`;
  hiddenForm.target = 'hidden_iframe';
  
  // Add the data as a hidden input
  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'data';
  dataInput.value = JSON.stringify(payload);
  hiddenForm.appendChild(dataInput);
  
  // Create a hidden iframe to receive the response
  let iframe = document.getElementById('hidden_iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'hidden_iframe';
    iframe.name = 'hidden_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
  
  // Add the form to the document and submit it
  document.body.appendChild(hiddenForm);
  hiddenForm.submit();
  
  // Clean up
  setTimeout(() => {
    document.body.removeChild(hiddenForm);
  }, 1000);
}

// Load form data from Google Sheet with improved debugging
function loadFormData(formId, skipCache = false) {
  if (!currentAgent || !currentAgent.agentName) {
    console.error("Cannot load data: No current agent");
    return;
  }
  
  const sheetName = formSheetMap[formId];
  if (!sheetName) {
    console.error(`Error: Sheet not mapped for form ${formId}`);
    showToast('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  // Show loading indicator
  updateSaveStatus('Loading...', `${formId}SaveStatus`);
  console.log(`Loading data for ${formId} from sheet ${sheetName} for agent ${currentAgent.agentName}`);

  // Clear any previous callback to avoid conflicts
  if (window[`handleFormDataResponse_${formId}`]) {
    delete window[`handleFormDataResponse_${formId}`];
  }

  const callbackName = 'handleFormDataResponse_' + formId + '_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log(`Form Data Response for ${formId}:`, response);
    
    if (response.status === 'error') {
      console.error(`Error loading data for ${formId}: ${response.message}`);
      showToast('Error loading data: ' + response.message, 'error');
      updateSaveStatus('Error loading!', `${formId}SaveStatus`);
      return;
    }
    
    // For multi-entry forms, we expect an array of entries
    if (['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
      const entries = response.entries || [];
      console.log(`Received ${entries.length} entries for ${formId}`);
      localStorage.setItem(`${formId}_entries`, JSON.stringify(entries));
      renderMultiEntryTable(formId, entries);
      updateSaveStatus('Data loaded!', `${formId}SaveStatus`);
    } else {
      // For single-entry forms, populate the form with the data
      console.log(`Received data for ${formId}:`, response);
      populateForm(formId, response);
      updateSaveStatus('Data loaded!', `${formId}SaveStatus`);
    }
  };
  
  const sessionId = currentAgent.agentName; // Use agent name as session ID
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=${encodeURIComponent(sheetName)}&sessionId=${encodeURIComponent(sessionId)}&t=${timestamp}`;
  
  // Add error handling for script loading
  script.onerror = function() {
    console.error(`Failed to load data for ${formId} - script loading error`);
    showToast('Error loading data: Network error', 'error');
    updateSaveStatus('Error loading!', `${formId}SaveStatus`);
  };
  
  document.head.appendChild(script);
  console.log(`Sent request to load data for ${formId}: ${script.src}`);
}

// Improve form data handling to prevent data loss
function populateForm(formId, data) {
  console.log(`Populating form ${formId} with data:`, data);
  const form = document.getElementById(formId);
  if (!form) {
    console.error(`Form with ID ${formId} not found`);
    return;
  }

  // Set the record_id if it exists in the data
  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    if (data.record_id) {
      recordIdInput.value = data.record_id;
      console.log(`Set record_id to ${data.record_id}`);
    } else if (currentAgent) {
      // If no record_id in data, create one
      const newRecordId = `${currentAgent.agentName}_${formId}`;
      recordIdInput.value = newRecordId;
      console.log(`Created new record_id: ${newRecordId}`);
    }
  }

  // Loop through all form elements and set their values
  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    // Skip the record_id field as we've already handled it
    if (input.name === 'record_id') return;
    
    // Get the corresponding data field (convert to lowercase and replace spaces with underscores)
    const fieldName = input.name.toLowerCase().replace(/ /g, '_');
    const dataField = data[fieldName] || data[input.name];
    
    console.log(`Setting field ${input.name} (${fieldName}) to value:`, dataField);
    
    if (dataField !== undefined && dataField !== null) {
      if (input.type === 'checkbox') {
        // For checkboxes, set the checked property based on the value
        input.checked = dataField === true || dataField === 'Yes' || dataField === 'yes' || dataField === 'true';
      } else if (input.type === 'radio') {
        // For radio buttons, check if the value matches
        input.checked = input.value === dataField.toString();
      } else if (input.type === 'date' && dataField) {
        // For date inputs, ensure the value is in YYYY-MM-DD format
        try {
          const date = new Date(dataField);
          if (!isNaN(date.getTime())) {
            const formattedDate = date.toISOString().split('T')[0];
            input.value = formattedDate;
          } else {
            input.value = dataField;
          }
        } catch (e) {
          console.error(`Error formatting date for ${input.name}:`, e);
          input.value = dataField;
        }
      } else {
        // For all other input types, just set the value
        input.value = dataField;
      }
    } else {
      // Clear the field if no data is available
      if (input.type === 'checkbox' || input.type === 'radio') {
        input.checked = false;
      } else {
        input.value = '';
      }
    }
  });
  
  console.log(`Form ${formId} populated successfully`);
}

function clearForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  form.reset(); // Resets all form fields to their initial state

  // Clear hidden record_id
  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    recordIdInput.value = '';
  }

  // Specific handling for currency inputs if they need initial formatting
  if (formId === 'expensesForm') {
    const amountInput = form.querySelector('[name="amount"]');
    if (amountInput) {
      amountInput.value = ''; // Ensure it's truly empty, not '₱0.00'
      setupCurrencyInput(amountInput); // Re-apply formatting logic
    }
  }
}


// --- Multi-Entry Form Rendering and Editing ---

function renderMultiEntryTable(formId, entries) {
  const tableBody = document.querySelector(`#${formId.replace('Form', 'sTable')} tbody`);
  if (!tableBody) {
    console.error(`Table body for ${formId} not found`);
    return;
  }

  console.log(`Rendering table for ${formId} with ${entries.length} entries`);
  tableBody.innerHTML = ''; // Clear existing rows

  if (entries.length === 0) {
    // Add a message row if no entries
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6; // Span all columns
    cell.textContent = 'No entries found. Add a new entry to get started.';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    return;
  }

  entries.forEach((entry, index) => {
    const row = tableBody.insertRow();
    row.dataset.recordId = entry.record_id; // Store record_id on the row
    row.dataset.index = index; // Store index for editing

    if (formId === 'dreamsForm') {
      row.insertCell().textContent = entry.time_frame || '';
      row.insertCell().textContent = entry.dream || '';
      row.insertCell().textContent = entry.why || '';
      
      // Add actions cell
      const actionsCell = row.insertCell();
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-edit';
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.onclick = function() { editMultiEntry(formId, index); };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete ml-2';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.onclick = function() { deleteMultiEntry(formId, index); };
      
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
    } else if (formId === 'expensesForm') {
      row.insertCell().textContent = entry.item || '';
      row.insertCell().textContent = formatCurrency(entry.amount);
      row.insertCell().textContent = entry.category || '';
      row.insertCell().textContent = entry.date ? new Date(entry.date).toLocaleDateString() : '';
      row.insertCell().textContent = entry.description || '';
      
      // Add actions cell
      const actionsCell = row.insertCell();
      const editBtn = document.createElement('button');
      editBtn.className = 'btn-edit';
      editBtn.innerHTML = '<i class="fas fa-edit"></i>';
      editBtn.onclick = function() { editMultiEntry(formId, index); };
      
      const deleteBtn = document.createElement('button');
      deleteBtn.className = 'btn-delete ml-2';
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
      deleteBtn.onclick = function() { deleteMultiEntry(formId, index); };
      
      actionsCell.appendChild(editBtn);
      actionsCell.appendChild(deleteBtn);
    }
  });
}

// Debug function to check all page elements
function debugPageElements() {
  console.log('--- DEBUG: Page Elements ---');
  
  // Check all page-content elements
  console.log('Page content elements:');
  document.querySelectorAll('.page-content').forEach(page => {
    console.log(`- ${page.id}: visible=${!page.classList.contains('hidden')}`);
  });
  
  // Check all sidebar links
  console.log('Sidebar links:');
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    console.log(`- ${link.getAttribute('data-page')}: visible=${link.style.display !== 'none'}, active=${link.classList.contains('active')}`);
  });
  
  // Check current agent
  console.log('Current agent:', currentAgent);
  
  // Check current page
  console.log('Current page:', currentPage);
}

// Add this login function
function login() {
  const agentName = document.getElementById('agentName').value;
  const password = document.getElementById('password').value;
  
  if (!agentName || !password) {
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.style.display = 'block';
      loginError.textContent = 'Agent name and password are required.';
    }
    return false;
  }
  
  console.log('Attempting login for:', agentName);
  
  // Create a unique callback name
  const callbackName = 'handleLoginResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Login response:', response);
    
    if (response.error) {
      const loginError = document.getElementById('loginError');
      if (loginError) {
        loginError.style.display = 'block';
        loginError.textContent = response.error;
      }
      return;
    }
    
    // Login successful
    currentAgent = {
      agentName: response.agentName,
      role: response.role || 'user',
      avatarUrl: response.avatarUrl || ''
    };
    
    console.log('Login successful. Current agent:', currentAgent);
    console.log('Role from server:', response.role);
    
    // Save to session storage
    sessionStorage.setItem('currentAgent', JSON.stringify(currentAgent));
    
    // Update UI - check if elements exist before accessing
    const loginPage = document.getElementById('loginPage');
    const appContainer = document.getElementById('appContainer');
    const dashboardPage = document.getElementById('dashboardPage');
    
    if (loginPage) loginPage.style.display = 'none';
    
    // Try both appContainer and dashboardPage
    if (appContainer) {
      appContainer.style.display = 'flex';
    } else if (dashboardPage) {
      dashboardPage.style.display = 'flex';
    }
    
    // Set up role-based access
    setupRoleBasedAccess();
    
    // Navigate to dashboard
    navigateTo('dashboardPageContent');
    
    // Show welcome message
    showToast(`Welcome, ${currentAgent.agentName}! (${currentAgent.role})`, 'success');
    
    // Update header with agent name
    const headerAgentName = document.getElementById('headerAgentName');
    if (headerAgentName) headerAgentName.textContent = currentAgent.agentName;
    
    // Update sidebar with agent info
    const agentNameDisplay = document.getElementById('agentNameDisplay');
    const agentRoleDisplay = document.getElementById('agentRoleDisplay');
    const agentAvatar = document.getElementById('agentAvatar');
    
    if (agentNameDisplay) agentNameDisplay.textContent = currentAgent.agentName;
    if (agentRoleDisplay) agentRoleDisplay.textContent = currentAgent.role;
    if (agentAvatar && currentAgent.avatarUrl) {
      agentAvatar.src = currentAgent.avatarUrl;
    } else if (agentAvatar) {
      // Set default avatar with agent's initials
      agentAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.agentName)}&background=random`;
    }
    
    // Debug page elements
    debugPageElements();
  };
  
  // Create and append the script tag for JSONP request
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=login&agent=${encodeURIComponent(agentName)}&password=${encodeURIComponent(password)}`;
  
  // Add error handling
  script.onerror = function() {
    console.error('Login script loading error');
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.style.display = 'block';
      loginError.textContent = 'Network error. Please try again.';
    }
  };
  
  document.head.appendChild(script);
  return false; // Prevent form submission
}

// Function to check and fix admin user
function checkAndFixAdmin() {
  console.log('Checking and fixing admin user...');
  const callbackName = 'handleCheckAdminResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Check admin response:', response);
    if (response.status === 'success') {
      showToast('Admin user checked and fixed if needed', 'success');
    } else {
      showToast('Error checking admin user: ' + response.message, 'error');
    }
  };

  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=checkAdmin`;
  document.head.appendChild(script);
}

// Check for existing session on page load
document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - Setting up event listeners');
  
  // Check and fix admin user
  checkAndFixAdmin();
  
  // Add event listener to login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      login();
    });
  }
  
  // Add event listeners to sidebar links
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const pageId = this.getAttribute('data-page');
      if (pageId) {
        // Remove the -form suffix if it's already in the data-page attribute
        const formSuffix = pageId.endsWith('-form') ? '' : '-form';
        navigateTo(pageId + formSuffix);
      }
    });
  });
  
  // Add logout functionality
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      // Clear session
      sessionStorage.removeItem('currentAgent');
      currentAgent = null;
      
      // Show login page, hide app
      const loginPage = document.getElementById('loginPage');
      const dashboardPage = document.getElementById('dashboardPage');
      
      if (loginPage) loginPage.style.display = 'flex';
      if (dashboardPage) dashboardPage.style.display = 'none';
      
      showToast('You have been logged out.', 'info');
    });
  }
  
  // Check for existing session
  console.log('Checking for existing session...');
  const savedAgent = sessionStorage.getItem('currentAgent');
  
  if (savedAgent) {
    try {
      currentAgent = JSON.parse(savedAgent);
      console.log('Found saved session for:', currentAgent.agentName, 'with role:', currentAgent.role);
      
      // Hide login page, show app
      const loginPage = document.getElementById('loginPage');
      const dashboardPage = document.getElementById('dashboardPage');
      
      if (loginPage) loginPage.style.display = 'none';
      if (dashboardPage) dashboardPage.style.display = 'flex';
      
      // Set up role-based access
      setupRoleBasedAccess();
      
      // Update UI with agent info
      const headerAgentName = document.getElementById('headerAgentName');
      if (headerAgentName) headerAgentName.textContent = currentAgent.agentName;
      
      const agentNameDisplay = document.getElementById('agentNameDisplay');
      const agentRoleDisplay = document.getElementById('agentRoleDisplay');
      const agentAvatar = document.getElementById('agentAvatar');
      
      if (agentNameDisplay) agentNameDisplay.textContent = currentAgent.agentName;
      if (agentRoleDisplay) agentRoleDisplay.textContent = currentAgent.role;
      if (agentAvatar && currentAgent.avatarUrl) {
        agentAvatar.src = currentAgent.avatarUrl;
      } else if (agentAvatar) {
        agentAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.agentName)}&background=random`;
      }
      
      // Navigate to dashboard
      navigateTo('dashboardPageContent');
    } catch (e) {
      console.error('Error restoring session:', e);
      sessionStorage.removeItem('currentAgent');
    }
  }
});

// Function to load personal details for the current user
function loadPersonalDetails() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('Cannot load personal details: No current agent');
    showToast('Please log in to view your personal details', 'error');
    return;
  }
  
  console.log('Loading personal details for', currentAgent.agentName);
  
  // Show loading status
  const statusElement = document.getElementById('personalFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  // Create a unique callback name
  const callbackName = 'handleGetPersonalDetailsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Personal Details Response:', response);
    console.log('Response type:', typeof response);
    console.log('Response keys:', response ? Object.keys(response) : 'null');
    
    if (response && !response.error) {
      // Populate the form with the data
      populateForm('personalForm', response);
      if (statusElement) {
        statusElement.textContent = 'Data loaded!';
        setTimeout(() => {
          statusElement.style.opacity = '0';
        }, 3000);
      }
    } else {
      console.error('Error loading personal details:', response ? response.error : 'Unknown error');
      if (statusElement) {
        statusElement.textContent = 'Error loading data';
      }
      
      // Make sure record_id is set even if no data was found
      const recordIdInput = document.getElementById('personalRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_personalForm`;
      }
    }
    
    // Clean up the callback
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=Personal%20Details&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  console.log('Loading personal details with URL:', url);
  script.src = url;
  
  // Add error handling
  script.onerror = function() {
    console.error('Failed to load personal details - script loading error');
    if (statusElement) {
      statusElement.textContent = 'Error loading data: Network error';
    }
  };
  
  document.head.appendChild(script);
}

// Function to load all personal details for admin view
function loadAllPersonalDetails() {
  if (!currentAgent || !currentAgent.role !== 'admin') {
    console.error('Cannot load all personal details: Not an admin');
    return;
  }
  
  console.log('Loading all personal details (admin view)');
  
  // Create a unique callback name
  const callbackName = 'handleGetAllPersonalDetailsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('All Personal Details Response:', response);
    
    if (response && response.status === 'success' && response.entries) {
      // Display the entries in a table or other UI element
      console.log(`Received ${response.entries.length} personal detail entries`);
      
      // Here you would typically populate a table or other UI element
      // For now, we'll just log the entries
      response.entries.forEach(entry => {
        console.log(`Entry for ${entry.agent || entry.name}: ${JSON.stringify(entry)}`);
      });
      
      showToast(`Loaded ${response.entries.length} personal detail entries`, 'success');
    } else {
      console.error('Error loading all personal details:', response ? response.message : 'Unknown error');
      showToast('Error loading all personal details', 'error');
    }
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getAllPersonalDetails&t=${timestamp}`;
  console.log('Loading all personal details with URL:', url);
  script.src = url;
  
  // Add error handling
  script.onerror = function() {
    console.error('Failed to load all personal details - script loading error');
    showToast('Error loading all personal details: Network error', 'error');
  };
  
  document.head.appendChild(script);
}

// Function to load users for admin view
function loadUsers() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    console.error('Cannot load users: Not an admin');
    showToast('Admin access required to view users', 'error');
    return;
  }
  
  console.log('Loading users (admin view)');
  
  // Create a unique callback name
  const callbackName = 'handleGetUsersResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Users Response:', response);
    
    if (response && response.status === 'success' && response.users) {
      // Display the users in the users table
      const usersTableBody = document.querySelector('#usersTable tbody');
      if (!usersTableBody) {
        console.error('Users table body not found');
        return;
      }
      
      usersTableBody.innerHTML = ''; // Clear existing rows
      
      if (response.users.length === 0) {
        // Add a message row if no users
        const row = usersTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4; // Span all columns
        cell.textContent = 'No users found.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        return;
      }
      
      // Add rows for each user
      response.users.forEach(user => {
        const row = usersTableBody.insertRow();
        
        // Agent Name
        const nameCell = row.insertCell();
        nameCell.textContent = user.agentName;
        
        // Role
        const roleCell = row.insertCell();
        roleCell.textContent = user.role || 'user';
        
        // Last Updated
        const lastUpdatedCell = row.insertCell();
        lastUpdatedCell.textContent = user.lastUpdated ? new Date(user.lastUpdated).toLocaleString() : 'Unknown';
        
        // Actions
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-secondary mr-2';
        editBtn.textContent = 'Edit';
        editBtn.onclick = function() {
          // Implement edit user functionality
          console.log('Edit user:', user.agentName);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = function() {
          // Implement delete user functionality
          console.log('Delete user:', user.agentName);
        };
        
        actionsCell.appendChild(editBtn);
        actionsCell.appendChild(deleteBtn);
      });
      
      showToast(`Loaded ${response.users.length} users`, 'success');
    } else {
      console.error('Error loading users:', response ? response.message : 'Unknown error');
      showToast('Error loading users', 'error');
    }
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getUsers&t=${timestamp}`;
  console.log('Loading users with URL:', url);
  script.src = url;
  
  // Add error handling
  script.onerror = function() {
    console.error('Failed to load users - script loading error');
    showToast('Error loading users: Network error', 'error');
  };
  
  document.head.appendChild(script);
}

// Function to set up the progressions form
function setupProgressionsForm() {
  const form = document.getElementById('progressionsForm');
  if (!form) {
    console.error('Progressions form not found');
    return;
  }
  
  console.log('Setting up progressions form');
  
  // Add event listeners to checkboxes for auto-save
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      console.log(`Checkbox ${this.name} changed to ${this.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving form...');
        saveProgressionsForm();
      }
    });
  });
  
  // Add event listener to the save button
  const saveButton = form.querySelector('button[type="submit"], button.save-button');
  if (saveButton) {
    saveButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Save button clicked');
      saveProgressionsForm();
    });
  }
  
  // Load initial data
  loadProgressionsData();
}

// Update navigateTo function to call setupProgressionsForm
function navigateTo(pageId) {
  console.log(`Attempting to navigate to: ${pageId}`);
  
  // Handle special case for dashboard
  if (pageId === 'dashboard') {
    pageId = 'dashboardPageContent';
  }
  
  // Fix double -form suffix issue
  if (pageId.endsWith('-form-form')) {
    pageId = pageId.replace('-form-form', '-form');
    console.log(`Fixed double form suffix, now navigating to: ${pageId}`);
  }
  
  // Map sidebar data-page values to actual page IDs
  const pageIdMap = {
    'personal-details': 'personal-details-form',
    'system-progressions': 'system-progressions-form',
    'dreams-list': 'dreams-list-form',
    'expenses-to-income-report': 'expenses-to-income-report-form',
    'potential-business-partners': 'potential-business-partners-form',
    'potential-field-trainings': 'potential-field-trainings-form',
    'user-management': 'user-management-form'
  };
  
  // Check if we need to map the pageId
  if (pageIdMap[pageId]) {
    console.log(`Mapping page ID from ${pageId} to ${pageIdMap[pageId]}`);
    pageId = pageIdMap[pageId];
  }
  
  // First, check if the page exists
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.error(`Error: Page with ID "${pageId}" not found`);
    console.log('Available page IDs:');
    document.querySelectorAll('.page-content').forEach(page => {
      console.log(`- ${page.id}`);
    });
    showToast(`Error: Page not found (${pageId})`, 'error');
    return; // Exit the function if the page doesn't exist
  }

  console.log(`Found target page: ${pageId}`);

  // Hide all pages and show the target page
  const pages = document.querySelectorAll('.page-content');
  pages.forEach(page => {
    page.classList.add('hidden');
    console.log(`Hidden page: ${page.id}`);
  });
  
  targetPage.classList.remove('hidden');
  console.log(`Showing page: ${pageId}`);

  // Load data for specific forms when navigating to them
  if (pageId === 'system-progressions-form') {
    console.log('Loading progressions data for newly navigated page');
    setupProgressionsForm();
  }
  
  // If navigating to personal details, load the current user's personal details
  if (pageId === 'personal-details-form') {
    console.log('Loading personal details for current user');
    setTimeout(() => {
      loadPersonalDetails(); // Load the current user's personal details
    }, 100);
    
    // If user is admin, also load all personal details
    if (currentAgent && currentAgent.role === 'admin') {
      console.log('Admin navigated to personal details, loading all personal details');
      setTimeout(() => {
        loadAllPersonalDetails(); // Delay slightly to ensure page is ready
      }, 200);
    }
  }
  
  // If navigating to user management and user is admin, load users list
  if (pageId === 'user-management-form' && currentAgent && currentAgent.role === 'admin') {
    loadUsers();
  }
  
  // Update sidebar active link
  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  sidebarLinks.forEach(link => link.classList.remove('active'));
  
  // Find and activate the corresponding sidebar link
  const sidebarPageIdMap = {
    'dashboardPageContent': 'dashboard',
    'personal-details-form': 'personal-details',
    'system-progressions-form': 'system-progressions',
    'dreams-list-form': 'dreams-list',
    'expenses-to-income-report-form': 'expenses-to-income-report',
    'potential-business-partners-form': 'potential-business-partners',
    'potential-field-trainings-form': 'potential-field-trainings',
    'user-management-form': 'user-management'
  };
  
  const sidebarPageId = sidebarPageIdMap[pageId];
  if (sidebarPageId) {
    const activeLink = document.querySelector(`.sidebar-menu a[data-page="${sidebarPageId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      console.log(`Set active sidebar link: ${sidebarPageId}`);
    }
  }
  
  currentPage = pageId; // Update current page global variable
  console.log(`Successfully navigated to: ${pageId}`);
}

// Add this to your document ready or initialization code
document.addEventListener('DOMContentLoaded', function() {
  // Other initialization code...
  
  // Set up event delegation for the progressions form
  document.body.addEventListener('click', function(e) {
    // Check if the clicked element is a checkbox in the progressions form
    if (e.target.matches('#progressionsForm input[type="checkbox"]')) {
      console.log(`Checkbox ${e.target.name} clicked, new state: ${e.target.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving form...');
        saveProgressionsForm();
      }
    }
    
    // Check if the clicked element is the save button in the progressions form
    if (e.target.matches('#progressionsForm button[type="submit"], #progressionsForm .save-button')) {
      e.preventDefault();
      console.log('Save button clicked');
      saveProgressionsForm();
    }
  });
});
