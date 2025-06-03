// Global variables
let currentPage = 'dashboard'; // Default to dashboard
let currentAgent = null; // Stores logged-in agent info
const AUTO_SAVE_DELAY = 2000; // 2 seconds
let autoSaveTimeout = null;
let autoSaveEnabled = true; // New variable to control auto-save feature

// Initialize data arrays for multi-entry forms
let dreamsData = [];

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
const scriptId = 'AKfycbwP9QCe8hVkAqlVvuU7WU3WJMhM6f8AlfEShSWLoOQWFLhYnXEbiiJRLwG9K6FmAYi5cQ'; // Replace with your actual script ID

const formSheetMap = {
  'personalForm': 'Personal Details',
  'progressionsForm': 'System Progressions',
  'licensingForm': 'Licensing Checklist',
  'dreamsForm': 'Dreams List',
  'expensesForm': 'Expenses to Income Report',
  'partnersForm': 'Potential Business Partners',
  'clientsForm': 'Potential Field Trainings',
  'careerProgressionForm': 'Career Progression'
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

function updateSaveStatus(message, statusElementId) {
  const statusEl = document.getElementById(statusElementId);
  if (!statusEl) return;
  statusEl.textContent = message;
  statusEl.style.opacity = '1';
  clearTimeout(autoSaveTimeout);
  autoSaveTimeout = setTimeout(() => {
    statusEl.style.opacity = '0';
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
    'licensing-checklist': 'licensing-checklist-form',
    'dreams-list': 'dreams-list-form',
    'expenses-to-income-report': 'expenses-to-income-report-form',
    'potential-business-partners': 'potential-business-partners-form',
    'potential-field-trainings': 'potential-field-trainings-form',
    'user-management': 'user-management-form',
    'career-progression': 'career-progression-form'
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
  
  if (pageId === 'licensing-checklist-form') {
    console.log('Loading licensing checklist data for newly navigated page');
    setupLicensingForm();
  }
  
  if (pageId === 'career-progression-form') {
    console.log('Loading career progression data for newly navigated page');
    setupCareerProgressionForm();
  }
  
  if (pageId === 'personal-details-form') {
    console.log('Loading personal details for current user');
    setTimeout(() => {
      loadPersonalDetails();
    }, 100);
    
    if (currentAgent && currentAgent.role === 'admin') {
      console.log('Admin navigated to personal details, loading all personal details');
      setTimeout(() => {
        loadAllPersonalDetails();
      }, 200);
    }
  }
  
  if (pageId === 'user-management-form' && currentAgent && currentAgent.role === 'admin') {
    loadUsers();
  }
  
  // Update sidebar active link
  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  sidebarLinks.forEach(link => link.classList.remove('active'));
  
  const sidebarPageIdMap = {
    'dashboardPageContent': 'dashboard',
    'personal-details-form': 'personal-details',
    'system-progressions-form': 'system-progressions',
    'licensing-checklist-form': 'licensing-checklist',
    'dreams-list-form': 'dreams-list',
    'expenses-to-income-report-form': 'expenses-to-income-report',
    'potential-business-partners-form': 'potential-business-partners',
    'potential-field-trainings-form': 'potential-field-trainings',
    'user-management-form': 'user-management',
    'career-progression-form': 'career-progression'
  };
  
  const sidebarPageId = sidebarPageIdMap[pageId];
  if (sidebarPageId) {
    const activeLink = document.querySelector(`.sidebar-menu a[data-page="${sidebarPageId}"]`);
    if (activeLink) {
      activeLink.classList.add('active');
      console.log(`Set active sidebar link: ${sidebarPageId}`);
    }
  }
  
  currentPage = pageId;
  console.log(`Successfully navigated to: ${pageId}`);
}

// --- Form Data Handling ---

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
  showToast('Saving progressions...', 'info');
  updateSaveStatus('Saving...', saveStatusElementId);
  
  const formData = new FormData(form);
  const recordIdInput = form.querySelector('input[name="record_id"]');
  let recordId = recordIdInput ? recordIdInput.value : '';
  
  if (!recordId) {
    recordId = `${currentAgent.agentName}_progressionsForm`;
    if (recordIdInput) {
      recordIdInput.value = recordId;
    }
  }
  
  const fields = {};
  for (let [key, value] of formData.entries()) {
    fields[key] = value;
  }
  
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    fields[checkbox.name] = formData.has(checkbox.name) ? true : false;
  });
  
  fields['agentName'] = currentAgent.agentName;
  fields['agent'] = currentAgent.agentName;
  
  console.log('Agent name being saved:', currentAgent.agentName);
  console.log('Fields object:', fields);
  
  const payload = {
    action: 'saveData',
    sheetName: 'System Progressions',
    record_id: recordId,
    fields: fields
  };
  
  console.log('Saving progressions with payload:', payload);
  
  const callbackName = 'handleSaveProgressionsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Save progressions response:', response);
    showToast('Progressions saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    
    setTimeout(() => {
      loadProgressionsData();
    }, 1000);
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=saveData&sheetName=System%20Progressions&record_id=${encodeURIComponent(recordId)}&agentName=${encodeURIComponent(currentAgent.agentName)}&agent=${encodeURIComponent(currentAgent.agentName)}&data=${encodeURIComponent(JSON.stringify(fields))}`;
  
  script.onerror = function() {
    console.error('Failed to save progressions - script loading error');
    showToast('Error saving progressions. Please try again.', 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
  };
  
  document.head.appendChild(script);
}

// Add a hidden input field for agentName to the progressions form
document.addEventListener('DOMContentLoaded', function() {
  const progressionsForm = document.getElementById('progressionsForm');
  if (progressionsForm) {
    if (!progressionsForm.querySelector('input[name="agentName"]')) {
      const agentNameInput = document.createElement('input');
      agentNameInput.type = 'hidden';
      agentNameInput.name = 'agentName';
      agentNameInput.id = 'progressionsAgentName';
      progressionsForm.appendChild(agentNameInput);
    }
    
    if (!progressionsForm.querySelector('input[name="record_id"]')) {
      const recordIdInput = document.createElement('input');
      recordIdInput.type = 'hidden';
      recordIdInput.name = 'record_id';
      recordIdInput.id = 'progressionsRecordId';
      progressionsForm.appendChild(recordIdInput);
    }
    
    progressionsForm.addEventListener('submit', function(event) {
      event.preventDefault();
      const agentNameInput = progressionsForm.querySelector('input[name="agentName"]');
      if (agentNameInput && currentAgent && currentAgent.agentName) {
        agentNameInput.value = currentAgent.agentName;
        console.log('Set agentName input value to:', agentNameInput.value);
      }
      saveProgressionsForm();
    });
  }
  
  const progressionsPage = document.getElementById('system-progressions-form');
  if (progressionsPage) {
    const refreshButton = document.createElement('button');
    refreshButton.type = 'button';
    refreshButton.className = 'btn btn-secondary mb-4';
    refreshButton.textContent = 'Refresh Data';
    refreshButton.onclick = function() {
      loadProgressionsData();
    };
    const pageDescription = progressionsPage.querySelector('.page-description');
    if (pageDescription && pageDescription.parentNode) {
      pageDescription.parentNode.insertBefore(refreshButton, pageDescription.nextSibling);
    }
  }
});

function loadProgressionsData() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('No current agent found');
    showToast('Please log in to view your system progressions', 'error');
    return;
  }
  
  console.log('Loading system progressions for', currentAgent.agentName);
  
  const statusElement = document.getElementById('progressionsFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  const callbackName = 'handleGetProgressionsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('System Progressions Response:', response);
    console.log('Response type:', typeof response);
    console.log('Response keys:', response ? Object.keys(response) : 'null');
    
    if (response && !response.error) {
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
      const recordIdInput = document.getElementById('progressionsRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_progressionsForm`;
      }
    }
    
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=System%20Progressions&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  console.log('Loading system progressions with URL:', url);
  script.src = url;
  
  script.onerror = function() {
    console.error('Failed to load system progressions - script loading error');
    if (statusElement) {
      statusElement.textContent = 'Error loading data: Network error';
    }
  };
  
  document.head.appendChild(script);
}

function populateProgressionsForm(data) {
  console.log('Populating progressions form with data:', data);
  const form = document.getElementById('progressionsForm');
  if (!form) {
    console.error('Progressions form not found');
    return;
  }

  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    if (data.record_id) {
      recordIdInput.value = data.record_id;
    } else if (currentAgent) {
      recordIdInput.value = `${currentAgent.agentName}_progressionsForm`;
    }
  }
  
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    const fieldName = checkbox.name;
    if (data[fieldName] !== undefined) {
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
      checkbox.checked = false;
      console.log(`No data for checkbox ${fieldName}, setting to unchecked`);
    }
  });
  
  const textInputs = form.querySelectorAll('input[type="text"], textarea, select');
  textInputs.forEach(input => {
    const fieldName = input.name;
    if (data[fieldName] !== undefined) {
      input.value = data[fieldName];
      console.log(`Set input ${fieldName} to ${input.value}`);
    }
  });
}

function saveFormData(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
    return;
  }

  if (formId === 'progressionsForm') {
    saveProgressionsForm();
    return;
  }

  if (formId === 'licensingForm') {
    saveLicensingForm();
    return;
  }

  if (formId === 'careerProgressionForm') {
    saveCareerProgressionData(new Event('submit'));
    return;
  }

  const form = document.getElementById(formId);
  const sheetName = formSheetMap[formId];
  const saveStatusElementId = `${formId}SaveStatus`;
  
  if (!sheetName) {
    showToast('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  showToast('Saving data...', 'info');
  updateSaveStatus('Saving...', saveStatusElementId);

  const formData = new FormData(form);
  const recordIdInput = form.querySelector('input[name="record_id"]');
  let recordId = recordIdInput ? recordIdInput.value : '';

  if (!recordId && ['personalForm', 'progressionsForm', 'licensingForm', 'careerProgressionForm'].includes(formId)) {
    recordId = `${currentAgent.agentName}_${formId}`;
    if (recordIdInput) {
      recordIdInput.value = recordId;
    }
  }

  if (!recordId) {
    recordId = generateRecordId(currentAgent.agentName, formId);
    if (recordIdInput) {
      recordIdInput.value = recordId;
    }
  }

  const fields = {};
  for (let [key, value] of formData.entries()) {
    fields[key] = value;
  }

  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    if (!formData.has(checkbox.name)) {
      fields[checkbox.name] = 'No';
    }
  });

  fields['agent'] = currentAgent.agentName;
  if (sheetName === 'System Progressions' || sheetName === 'Licensing Checklist' || sheetName === 'Career Progression') {
    fields['agentName'] = currentAgent.agentName;
  }

  const payload = {
    action: 'saveData',
    sheetName: sheetName,
    record_id: recordId,
    fields: fields
  };

  console.log('Saving data with payload:', payload);

  const jsonpCallback = 'handleSaveFormResponse_' + new Date().getTime();
  window[jsonpCallback] = function(response) {
    console.log('Save form response:', response);
    showToast('Data saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    
    if (!['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
      loadFormData(formId);
    }
  };
  
  const hiddenForm = document.createElement('form');
  hiddenForm.method = 'POST';
  hiddenForm.action = `https://script.google.com/macros/s/${scriptId}/exec?callback=${jsonpCallback}`;
  hiddenForm.target = 'hidden_iframe';
  
  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'data';
  dataInput.value = JSON.stringify(payload);
  hiddenForm.appendChild(dataInput);
  
  let iframe = document.getElementById('hidden_iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'hidden_iframe';
    iframe.name = 'hidden_iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
  
  document.body.appendChild(hiddenForm);
  hiddenForm.submit();
  
  setTimeout(() => {
    document.body.removeChild(hiddenForm);
  }, 1000);
}

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

  updateSaveStatus('Loading...', `${formId}SaveStatus`);
  console.log(`Loading data for ${formId} from sheet ${sheetName} for agent ${currentAgent.agentName}`);

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
    
    if (['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
      const entries = response.entries || [];
      console.log(`Received ${entries.length} entries for ${formId}`);
      localStorage.setItem(`${formId}_entries`, JSON.stringify(entries));
      renderMultiEntryTable(formId, entries);
      updateSaveStatus('Data loaded!', `${formId}SaveStatus`);
    } else {
      console.log(`Received data for ${formId}:`, response);
      populateForm(formId, response);
      updateSaveStatus('Data loaded!', `${formId}SaveStatus`);
    }
  };
  
  const sessionId = currentAgent.agentName;
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=${encodeURIComponent(sheetName)}&sessionId=${encodeURIComponent(sessionId)}&t=${timestamp}`;
  
  script.onerror = function() {
    console.error(`Failed to load data for ${formId} - script loading error`);
    showToast('Error loading data: Network error', 'error');
    updateSaveStatus('Error loading!', `${formId}SaveStatus`);
  };
  
  document.head.appendChild(script);
  console.log(`Sent request to load data for ${formId}: ${script.src}`);
}

function populateForm(formId, data) {
  console.log(`Populating form ${formId} with data:`, data);
  const form = document.getElementById(formId);
  if (!form) {
    console.error(`Form with ID ${formId} not found`);
    return;
  }

  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    if (data.record_id) {
      recordIdInput.value = data.record_id;
      console.log(`Set record_id to ${data.record_id}`);
    } else if (currentAgent) {
      const newRecordId = `${currentAgent.agentName}_${formId}`;
      recordIdInput.value = newRecordId;
      console.log(`Created new record_id: ${newRecordId}`);
    }
  }

  const inputs = form.querySelectorAll('input, select, textarea');
  inputs.forEach(input => {
    if (input.name === 'record_id') return;
    
    const fieldName = input.name.toLowerCase().replace(/ /g, '_');
    const dataField = data[fieldName] || data[input.name];
    
    console.log(`Setting field ${input.name} (${fieldName}) to value:`, dataField);
    
    if (dataField !== undefined && dataField !== null) {
      if (input.type === 'checkbox') {
        input.checked = dataField === true || dataField === 'Yes' || dataField === 'yes' || dataField === 'true';
      } else if (input.type === 'radio') {
        input.checked = input.value === dataField.toString();
      } else if (input.type === 'date' && dataField) {
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
        input.value = dataField;
      }
    } else {
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

  form.reset();

  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    recordIdInput.value = '';
  }

  if (formId === 'expensesForm') {
    const amountInput = form.querySelector('[name="amount"]');
    if (amountInput) {
      amountInput.value = '';
      setupCurrencyInput(amountInput);
    }
  }
}

function renderMultiEntryTable(formId, entries) {
  // The issue is here - we need to fix the selector
  const tableId = formId.replace('Form', 'Table');
  const tableBody = document.querySelector(`#${tableId} tbody`);
  if (!tableBody) {
    console.error(`Table body for ${formId} not found. Looking for #${tableId} tbody`);
    return;
  }

  console.log(`Rendering table for ${formId} with ${entries.length} entries`);
  tableBody.innerHTML = '';

  if (entries.length === 0) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 6;
    cell.textContent = 'No entries found. Add a new entry to get started.';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    return;
  }

  entries.forEach((entry, index) => {
    const row = tableBody.insertRow();
    row.dataset.recordId = entry.record_id;
    row.dataset.index = index;

    if (formId === 'dreamsForm') {
      row.insertCell().textContent = entry.time_frame || '';
      row.insertCell().textContent = entry.dream || '';
      row.insertCell().textContent = entry.why || '';
      
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

function debugPageElements() {
  console.log('--- DEBUG: Page Elements ---');
  console.log('Page content elements:');
  document.querySelectorAll('.page-content').forEach(page => {
    console.log(`- ${page.id}: visible=${!page.classList.contains('hidden')}`);
  });
  
  console.log('Sidebar links:');
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    console.log(`- ${link.getAttribute('data-page')}: visible=${link.style.display !== 'none'}, active=${link.classList.contains('active')}`);
  });
  
  console.log('Current agent:', currentAgent);
  console.log('Current page:', currentPage);
}

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
    
    currentAgent = {
      agentName: response.agentName,
      role: response.role || 'user',
      avatarUrl: response.avatarUrl || ''
    };
    
    console.log('Login successful. Current agent:', currentAgent);
    console.log('Role from server:', response.role);
    
    sessionStorage.setItem('currentAgent', JSON.stringify(currentAgent));
    
    const loginPage = document.getElementById('loginPage');
    const appContainer = document.getElementById('appContainer');
    const dashboardPage = document.getElementById('dashboardPage');
    
    if (loginPage) loginPage.style.display = 'none';
    
    if (appContainer) {
      appContainer.style.display = 'flex';
    } else if (dashboardPage) {
      dashboardPage.style.display = 'flex';
    }
    
    setupRoleBasedAccess();
    navigateTo('dashboardPageContent');
    showToast(`Welcome, ${currentAgent.agentName}! (${currentAgent.role})`, 'success');
    
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
    
    debugPageElements();
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=login&agent=${encodeURIComponent(agentName)}&password=${encodeURIComponent(password)}`;
  
  script.onerror = function() {
    console.error('Login script loading error');
    const loginError = document.getElementById('loginError');
    if (loginError) {
      loginError.style.display = 'block';
      loginError.textContent = 'Network error. Please try again.';
    }
  };
  
  document.head.appendChild(script);
  return false;
}

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

document.addEventListener('DOMContentLoaded', function() {
  console.log('DOM Content Loaded - Setting up event listeners');
  
  checkAndFixAdmin();
  
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      login();
    });
  }
  
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const pageId = this.getAttribute('data-page');
      if (pageId) {
        const formSuffix = pageId.endsWith('-form') ? '' : '-form';
        navigateTo(pageId + formSuffix);
      }
    });
  });
  
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      sessionStorage.removeItem('currentAgent');
      currentAgent = null;
      
      const loginPage = document.getElementById('loginPage');
      const dashboardPage = document.getElementById('dashboardPage');
      
      if (loginPage) loginPage.style.display = 'flex';
      if (dashboardPage) dashboardPage.style.display = 'none';
      
      showToast('You have been logged out.', 'info');
    });
  }
  
  console.log('Checking for existing session...');
  const savedAgent = sessionStorage.getItem('currentAgent');
  
  if (savedAgent) {
    try {
      currentAgent = JSON.parse(savedAgent);
      console.log('Found saved session for:', currentAgent.agentName, 'with role:', currentAgent.role);
      
      const loginPage = document.getElementById('loginPage');
      const dashboardPage = document.getElementById('dashboardPage');
      
      if (loginPage) loginPage.style.display = 'none';
      if (dashboardPage) dashboardPage.style.display = 'flex';
      
      setupRoleBasedAccess();
      
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
      
      navigateTo('dashboardPageContent');
    } catch (e) {
      console.error('Error restoring session:', e);
      sessionStorage.removeItem('currentAgent');
    }
  }
});

function loadPersonalDetails() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('Cannot load personal details: No current agent');
    showToast('Please log in to view your personal details', 'error');
    return;
  }
  
  console.log('Loading personal details for', currentAgent.agentName);
  
  const statusElement = document.getElementById('personalFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  const callbackName = 'handleGetPersonalDetailsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Personal Details Response:', response);
    console.log('Response type:', typeof response);
    console.log('Response keys:', response ? Object.keys(response) : 'null');
    
    if (response && !response.error) {
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
      const recordIdInput = document.getElementById('personalRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_personalForm`;
      }
    }
    
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=Personal%20Details&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  console.log('Loading personal details with URL:', url);
  script.src = url;
  
  script.onerror = function() {
    console.error('Failed to load personal details - script loading error');
    if (statusElement) {
      statusElement.textContent = 'Error loading data: Network error';
    }
  };
  
  document.head.appendChild(script);
}

function loadAllPersonalDetails() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    console.error('Cannot load all personal details: Not an admin');
    return;
  }
  
  console.log('Loading all personal details (admin view)');
  
  const callbackName = 'handleGetAllPersonalDetailsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('All Personal Details Response:', response);
    
    if (response && response.status === 'success' && response.entries) {
      console.log(`Received ${response.entries.length} personal detail entries`);
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
  const timestamp = new Date().getTime();
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getAllPersonalDetails&t=${timestamp}`;
  console.log('Loading all personal details with URL:', url);
  script.src = url;
  
  script.onerror = function() {
    console.error('Failed to load all personal details - script loading error');
    showToast('Error loading all personal details: Network error', 'error');
  };
  
  document.head.appendChild(script);
}

function loadUsers() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    console.error('Cannot load users: Not an admin');
    showToast('Admin access required to view users', 'error');
    return;
  }
  
  console.log('Loading users (admin view)');
  
  const callbackName = 'handleGetUsersResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Users Response:', response);
    
    if (response && response.status === 'success' && response.users) {
      const usersTableBody = document.querySelector('#usersTable tbody');
      if (!usersTableBody) {
        console.error('Users table body not found');
        return;
      }
      
      usersTableBody.innerHTML = '';
      
      if (response.users.length === 0) {
        const row = usersTableBody.insertRow();
        const cell = row.insertCell();
        cell.colSpan = 4;
        cell.textContent = 'No users found.';
        cell.style.textAlign = 'center';
        cell.style.padding = '20px';
        return;
      }
      
      response.users.forEach(user => {
        const row = usersTableBody.insertRow();
        row.insertCell().textContent = user.agentName;
        row.insertCell().textContent = user.role || 'user';
        row.insertCell().textContent = user.lastUpdated ? new Date(user.lastUpdated).toLocaleString() : 'Unknown';
        
        const actionsCell = row.insertCell();
        const editBtn = document.createElement('button');
        editBtn.className = 'btn btn-sm btn-secondary mr-2';
        editBtn.textContent = 'Edit';
        editBtn.onclick = function() {
          console.log('Edit user:', user.agentName);
        };
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'btn btn-sm btn-danger';
        deleteBtn.textContent = 'Delete';
        deleteBtn.onclick = function() {
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
  const timestamp = new Date().getTime();
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getUsers&t=${timestamp}`;
  console.log('Loading users with URL:', url);
  script.src = url;
  
  script.onerror = function() {
    console.error('Failed to load users - script loading error');
    showToast('Error loading users: Network error', 'error');
  };
  
  document.head.appendChild(script);
}

function setupProgressionsForm() {
  const form = document.getElementById('progressionsForm');
  if (!form) {
    console.error('Progressions form not found');
    return;
  }
  
  console.log('Setting up progressions form');
  
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
  
  const saveButton = form.querySelector('button[type="submit"], button.save-button');
  if (saveButton) {
    saveButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Save button clicked');
      saveProgressionsForm();
    });
  }
  
  loadProgressionsData();
}

function setupLicensingForm() {
  const form = document.getElementById('licensingForm');
  if (!form) {
    console.error('Licensing form not found');
    return;
  }
  
  console.log('Setting up licensing form');
  
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      console.log(`Checkbox ${this.name} changed to ${this.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving form...');
        saveLicensingForm();
      }
    });
  });
  
  const saveButton = form.querySelector('button[type="submit"], button.save-button');
  if (saveButton) {
    saveButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Save button clicked');
      saveLicensingForm();
    });
  }
  
  loadLicensingData();
}

function saveLicensingForm() {
  const form = document.getElementById('licensingForm');
  if (!form) {
    console.error('Licensing form not found');
    return;
  }
  
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
    return;
  }
  
  const saveStatusElementId = 'licensingFormSaveStatus';
  showToast('Saving licensing checklist...', 'info');
  updateSaveStatus('Saving...', saveStatusElementId);
  
  const formData = new FormData(form);
  const recordIdInput = form.querySelector('input[name="record_id"]');
  let recordId = recordIdInput ? recordIdInput.value : '';
  
  if (!recordId) {
    recordId = `${currentAgent.agentName}_licensingForm`;
    if (recordIdInput) {
      recordIdInput.value = recordId;
    }
  }
  
  const fields = {};
  for (let [key, value] of formData.entries()) {
    fields[key] = value;
  }
  
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    fields[checkbox.name] = formData.has(checkbox.name) ? true : false;
  });
  
  fields['agentName'] = currentAgent.agentName;
  fields['agent'] = currentAgent.agentName;
  
  console.log('Agent name being saved:', currentAgent.agentName);
  console.log('Fields object:', fields);
  
  const payload = {
    action: 'saveData',
    sheetName: 'Licensing Checklist',
    record_id: recordId,
    fields: fields
  };
  
  console.log('Saving licensing checklist with payload:', payload);
  
  const callbackName = 'handleSaveLicensingResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Save licensing response:', response);
    showToast('Licensing checklist saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    
    setTimeout(() => {
      loadLicensingData();
    }, 1000);
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=saveData&sheetName=Licensing%20Checklist&record_id=${encodeURIComponent(recordId)}&agentName=${encodeURIComponent(currentAgent.agentName)}&agent=${encodeURIComponent(currentAgent.agentName)}&data=${encodeURIComponent(JSON.stringify(fields))}`;
  
  script.onerror = function() {
    console.error('Failed to save licensing checklist - script loading error');
    showToast('Error saving licensing checklist. Please try again.', 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
  };
  
  document.head.appendChild(script);
}

function loadLicensingData() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('No current agent found');
    showToast('Please log in to view your licensing checklist', 'error');
    return;
  }
  
  console.log('Loading licensing checklist for', currentAgent.agentName);
  
  const statusElement = document.getElementById('licensingFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  const callbackName = 'handleGetLicensingResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Licensing Checklist Response:', response);
    
    if (response && !response.error) {
      populateLicensingForm(response);
      if (statusElement) {
        statusElement.textContent = 'Data loaded!';
        setTimeout(() => {
          statusElement.style.opacity = '0';
        }, 3000);
      }
    } else {
      console.error('Error loading licensing checklist:', response ? response.error : 'Unknown error');
      if (statusElement) {
        statusElement.textContent = 'Error loading data';
      }
      const recordIdInput = document.getElementById('licensingRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_licensingForm`;
      }
    }
    
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=Licensing%20Checklist&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  console.log('Loading licensing checklist with URL:', url);
  script.src = url;
  
  script.onerror = function() {
    console.error('Failed to load licensing checklist - script loading error');
    if (statusElement) {
      statusElement.textContent = 'Error loading data: Network error';
    }
  };
  
  document.head.appendChild(script);
}

function populateLicensingForm(data) {
  console.log('Populating licensing form with data:', data);
  const form = document.getElementById('licensingForm');
  if (!form) {
    console.error('Licensing form not found');
    return;
  }

  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    if (data.record_id) {
      recordIdInput.value = data.record_id;
    } else if (currentAgent) {
      recordIdInput.value = `${currentAgent.agentName}_licensingForm`;
    }
  }
  
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    const fieldName = checkbox.name;
    if (data[fieldName] !== undefined) {
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
      checkbox.checked = false;
      console.log(`No data for checkbox ${fieldName}, setting to unchecked`);
    }
  });
  
  const textInputs = form.querySelectorAll('input[type="text"], textarea, select');
  textInputs.forEach(input => {
    const fieldName = input.name;
    if (data[fieldName] !== undefined) {
      input.value = data[fieldName];
      console.log(`Set input ${fieldName} to ${input.value}`);
    }
  });
}

function setupCareerProgressionForm() {
  const form = document.getElementById('careerProgressionForm');
  if (!form) {
    console.error('Career progression form not found');
    return;
  }
  
  console.log('Setting up career progression form');
  
  // Add event listeners to all checkboxes
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', function() {
      console.log(`Checkbox ${this.name} changed to ${this.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving career progression form...');
        saveCareerProgressionData(new Event('submit'));
      }
    });
  });
  
  const saveButton = form.querySelector('button[type="submit"], button.save-button');
  if (saveButton) {
    saveButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log('Career progression save button clicked');
      saveCareerProgressionData(e);
    });
  }
  
  loadCareerProgressionData();
}

function loadCareerProgressionData() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('No current agent found');
    showToast('Please log in to view your career progression', 'error');
    return;
  }
  
  console.log('Loading career progression for', currentAgent.agentName);
  
  const statusElement = document.getElementById('careerProgressionFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  const callbackName = 'handleGetCareerProgressionResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Career Progression Response:', response);
    
    if (response && !response.error) {
      populateCareerProgressionForm(response);
      if (statusElement) {
        statusElement.textContent = 'Data loaded!';
        setTimeout(() => {
          statusElement.style.opacity = '0';
        }, 3000);
      }
    } else {
      console.error('Error loading career progression:', response ? response.error : 'Unknown error');
      if (statusElement) {
        statusElement.textContent = 'Error loading data';
      }
      const recordIdInput = document.getElementById('careerProgressionRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_careerProgressionForm`;
      }
    }
    
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=Career%20Progression&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  console.log('Loading career progression with URL:', url);
  script.src = url;
  
  script.onerror = function() {
    console.error('Failed to load career progression - script loading error');
    if (statusElement) {
      statusElement.textContent = 'Error loading data: Network error';
    }
  };
  
  document.head.appendChild(script);
}

function saveCareerProgressionData(event) {
  event.preventDefault();
  
  if (!currentAgent) {
    console.error('No agent logged in');
    showToast('Please log in to save data', 'error');
    return;
  }
  
  const saveStatusElementId = 'careerProgressionFormSaveStatus';
  updateSaveStatus('Saving...', saveStatusElementId);
  
  const form = document.getElementById('careerProgressionForm');
  if (!form) {
    console.error('Career progression form not found');
    showToast('Error: Form not found', 'error');
    return;
  }
  
  const formData = new FormData(form);
  const fields = {};
  
  for (const [key, value] of formData.entries()) {
    fields[key] = value;
  }
  
  // Important: Handle checkboxes properly
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    // Store checkbox values as "true" or "false" strings
    // This is important for Google Sheets compatibility
    fields[checkbox.name] = checkbox.checked ? "true" : "false";
  });
  
  fields['agentName'] = currentAgent.agentName;
  fields['agent'] = currentAgent.agentName;
  
  const recordIdField = document.getElementById('careerProgressionRecordId');
  let recordId = recordIdField?.value || `${currentAgent.agentName}_careerProgressionForm`;
  if (recordIdField) {
    recordIdField.value = recordId;
  }
  
  console.log('Saving career progression data with record ID:', recordId);
  console.log('Fields being saved:', fields); // Debug log
  
  const callbackName = 'handleSaveCareerProgressionResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Save career progression response:', response);
    if (response && !response.error) {
      showToast('Career progression data saved successfully!', 'success');
      updateSaveStatus('Saved!', saveStatusElementId);
      
      // Don't reload immediately - give the server time to process
      setTimeout(() => loadCareerProgressionData(), 1000);
    } else {
      console.error('Error saving career progression:', response?.error || 'Unknown error');
      showToast('Error saving career progression. Please try again.', 'error');
      updateSaveStatus('Error saving!', saveStatusElementId);
    }
    delete window[callbackName];
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=saveData&sheetName=Career%20Progression&record_id=${encodeURIComponent(recordId)}&agentName=${encodeURIComponent(currentAgent.agentName)}&agent=${encodeURIComponent(currentAgent.agentName)}&data=${encodeURIComponent(JSON.stringify(fields))}`;
  
  script.onerror = function() {
    console.error('Failed to save career progression - script loading error');
    showToast('Error saving career progression: Network error', 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
    delete window[callbackName];
  };
  
  document.head.appendChild(script);
}

document.addEventListener('DOMContentLoaded', function() {
  console.log('Document ready, initializing app...');
  
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const pageId = this.getAttribute('data-page');
      navigateTo(pageId);
    });
  });
  
  document.querySelectorAll('form').forEach(form => {
    form.addEventListener('submit', function(e) {
      e.preventDefault();
      const formId = this.id;
      console.log(`Form ${formId} submitted`);
      
      if (formId === 'personalForm') {
        saveFormData(formId);
      } else if (formId === 'progressionsForm') {
        saveProgressionsForm();
      } else if (formId === 'licensingForm') {
        saveLicensingForm();
      } else if (formId === 'dreamsForm') {
        saveFormData(formId);
      } else if (formId === 'expensesForm') {
        saveFormData(formId);
      } else if (formId === 'partnersForm') {
        saveFormData(formId);
      } else if (formId === 'clientsForm') {
        saveFormData(formId);
      } else if (formId === 'loginForm') {
        login();
      } else if (formId === 'userForm') {
        saveFormData(formId);
      } else if (formId === 'careerProgressionForm') {
        saveCareerProgressionData(e);
      }
    });
  });
  
  document.querySelectorAll('.auto-save-toggle').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      toggleAutoSave();
    });
  });
  
  document.body.addEventListener('click', function(e) {
    if (e.target.matches('#progressionsForm input[type="checkbox"]')) {
      console.log(`Checkbox ${e.target.name} clicked, new state: ${e.target.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving form...');
        saveProgressionsForm();
      }
    }
    
    if (e.target.matches('#progressionsForm button[type="submit"], #progressionsForm .save-button')) {
      e.preventDefault();
      console.log('Save button clicked');
      saveProgressionsForm();
    }
    
    if (e.target.matches('#licensingForm input[type="checkbox"]')) {
      console.log(`Checkbox ${e.target.name} clicked, new state: ${e.target.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving licensing form...');
        saveLicensingForm();
      }
    }
    
    if (e.target.matches('#licensingForm button[type="submit"], #licensingForm .save-button')) {
      e.preventDefault();
      console.log('Licensing save button clicked');
      saveLicensingForm();
    }
    
    if (e.target.matches('#careerProgressionForm input[type="checkbox"]')) {
      console.log(`Checkbox ${e.target.name} clicked, new state: ${e.target.checked}`);
      if (autoSaveEnabled) {
        console.log('Auto-save is enabled, saving career progression form...');
        saveCareerProgressionData(new Event('submit'));
      }
    }
    
    if (e.target.matches('#careerProgressionForm button[type="submit"], #careerProgressionForm .save-button')) {
      e.preventDefault();
      console.log('Career progression save button clicked');
      saveCareerProgressionData(new Event('submit'));
    }
  });
});

// Add event listener for the "Add New Dream" button
document.getElementById('addDreamEntryBtn').addEventListener('click', function() {
  // Clear the form fields
  document.getElementById('modalDreamForm').reset();
  document.getElementById('modalDreamRecordId').value = '';
  
  // Show the modal
  const modal = document.getElementById('dreamEntryModal');
  modal.classList.add('show');
});

// Add event listener for the close button
document.getElementById('closeDreamModal').addEventListener('click', function() {
  document.getElementById('dreamEntryModal').classList.remove('show');
});

// Add event listener for the save button in the dream modal
document.getElementById('saveModalDreamBtn').addEventListener('click', function() {
  const form = document.getElementById('modalDreamForm');
  const timeFrame = document.getElementById('modalTimeFrame').value;
  const dream = document.getElementById('modalDream').value;
  const why = document.getElementById('modalWhy').value;
  const recordId = document.getElementById('modalDreamRecordId').value;
  
  // Validate required fields
  if (!dream) {
    showToast('Please enter a dream', 'error');
    return;
  }
  
  // Add to dreams array or update existing entry
  if (recordId) {
    // Update existing entry
    const index = dreamsData.findIndex(entry => entry.record_id === recordId);
    if (index !== -1) {
      dreamsData[index] = {
        record_id: recordId,
        time_frame: timeFrame,
        dream: dream,
        why: why
      };
    }
  } else {
    // Add new entry
    const newRecordId = `dream_${Date.now()}`;
    dreamsData.push({
      record_id: newRecordId,
      time_frame: timeFrame,
      dream: dream,
      why: why
    });
  }
  
  // Re-render the table
  renderMultiEntryTable('dreamsForm', dreamsData);
  
  // Close the modal
  document.getElementById('dreamEntryModal').classList.remove('show');
  
  // Show success message
  showToast('Dream saved successfully', 'success');
});

// Load dreams data when the page loads
function loadDreamsData() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('No current agent found');
    showToast('Please log in to view your dreams', 'error');
    return;
  }
  
  console.log('Loading dreams data for agent:', currentAgent.agentName);
  
  const statusElement = document.getElementById('dreamsFormSaveStatus');
  if (statusElement) {
    statusElement.textContent = 'Loading...';
    statusElement.style.opacity = '1';
  }
  
  // Create a unique callback name
  const callbackName = 'handleLoadDreamsResponse_' + new Date().getTime();
  
  // Create global callback function
  window[callbackName] = function(response) {
    console.log('Load dreams response:', response);
    
    if (response && response.entries) {
      dreamsData = response.entries.map(entry => ({
        record_id: entry.record_id || generateRecordId(currentAgent.agentName, 'dream'),
        agent: entry.agent || currentAgent.agentName,
        time_frame: entry.time_frame || '',
        dream: entry.dream || '',
        why: entry.why || ''
      }));
      
      console.log('Loaded dreams data:', dreamsData);
      
      // Render the dreams table
      renderDreamsTable();
      
      if (statusElement) {
        statusElement.textContent = 'Data loaded!';
        setTimeout(() => {
          statusElement.style.opacity = '0';
        }, 3000);
      }
    } else {
      console.log('No dreams data found or error in response');
      dreamsData = []; // Initialize with empty array
      renderDreamsTable(); // Render empty table
      
      if (statusElement) {
        statusElement.textContent = 'No data found';
        setTimeout(() => {
          statusElement.style.opacity = '0';
        }, 3000);
      }
    }
    
    // Clean up the global callback
    delete window[callbackName];
  };
  
  // Create and append the script element
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=Dreams%20List&sessionId=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  
  script.onerror = function() {
    console.error('Failed to load dreams data - script loading error');
    showToast('Error loading dreams: Network error', 'error');
    if (statusElement) {
      statusElement.textContent = 'Error loading!';
    }
    delete window[callbackName];
  };
  
  document.head.appendChild(script);
}

// Function to render the dreams table
function renderDreamsTable() {
  const tableBody = document.querySelector('#dreamsTable tbody');
  if (!tableBody) {
    console.error('Dreams table body not found');
    return;
  }
  
  // Clear the table
  tableBody.innerHTML = '';
  
  // Add rows for existing data
  dreamsData.forEach((dream, index) => {
    const row = document.createElement('tr');
    
    // Time Frame cell
    const timeFrameCell = document.createElement('td');
    const timeFrameInput = document.createElement('input');
    timeFrameInput.type = 'text';
    timeFrameInput.value = dream.time_frame || '';
    timeFrameInput.className = 'form-control';
    timeFrameInput.addEventListener('change', function() {
      dreamsData[index].time_frame = this.value;
      if (autoSaveEnabled) {
        saveDreamsToServer();
      }
    });
    timeFrameCell.appendChild(timeFrameInput);
    
    // Dream cell
    const dreamCell = document.createElement('td');
    const dreamInput = document.createElement('textarea');
    dreamInput.value = dream.dream || '';
    dreamInput.className = 'form-control';
    dreamInput.rows = 3;
    dreamInput.addEventListener('change', function() {
      dreamsData[index].dream = this.value;
      if (autoSaveEnabled) {
        saveDreamsToServer();
      }
    });
    dreamCell.appendChild(dreamInput);
    
    // Why cell
    const whyCell = document.createElement('td');
    const whyInput = document.createElement('textarea');
    whyInput.value = dream.why || '';
    whyInput.className = 'form-control';
    whyInput.rows = 3;
    whyInput.addEventListener('change', function() {
      dreamsData[index].why = this.value;
      if (autoSaveEnabled) {
        saveDreamsToServer();
      }
    });
    whyCell.appendChild(whyInput);
    
    // Actions cell
    const actionsCell = document.createElement('td');
    const deleteBtn = document.createElement('button');
    deleteBtn.innerHTML = '<i class="fas fa-trash"></i>';
    deleteBtn.className = 'btn btn-sm btn-danger';
    deleteBtn.addEventListener('click', function() {
      dreamsData.splice(index, 1);
      renderDreamsTable();
      if (autoSaveEnabled) {
        saveDreamsToServer();
      }
    });
    actionsCell.appendChild(deleteBtn);
    
    // Add all cells to the row
    row.appendChild(timeFrameCell);
    row.appendChild(dreamCell);
    row.appendChild(whyCell);
    row.appendChild(actionsCell);
    
    // Add the row to the table
    tableBody.appendChild(row);
  });
  
  // Add empty row if no data
  if (dreamsData.length === 0) {
    const emptyRow = document.createElement('tr');
    const emptyCell = document.createElement('td');
    emptyCell.colSpan = 4;
    emptyCell.textContent = 'No dreams added yet. Click "Add Dream" to get started.';
    emptyCell.className = 'text-center py-4 text-gray-500';
    emptyRow.appendChild(emptyCell);
    tableBody.appendChild(emptyRow);
  }
}

// Function to add a new dream
function addNewDream() {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Please log in to add dreams', 'error');
    return;
  }
  
  const newDream = {
    record_id: generateRecordId(currentAgent.agentName, 'dream'),
    agent: currentAgent.agentName,
    time_frame: '',
    dream: '',
    why: ''
  };
  
  dreamsData.push(newDream);
  renderDreamsTable();
  
  // Scroll to the bottom of the table
  const table = document.getElementById('dreamsTable');
  if (table) {
    table.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}

// Save all dreams to the server
function saveDreamsToServer() {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
    return;
  }
  
  if (dreamsData.length === 0) {
    showToast('No dreams to save', 'warning');
    return;
  }
  
  const saveStatusElement = document.getElementById('dreamsFormSaveStatus');
  if (saveStatusElement) {
    saveStatusElement.textContent = 'Saving...';
    saveStatusElement.style.opacity = '1';
  }
  
  // Add agent name to each entry and ensure all required fields exist
  const entriesWithAgent = dreamsData.map(entry => {
    // Make sure all required fields exist and use 'agent' consistently
    return {
      record_id: entry.record_id || generateRecordId(currentAgent.agentName, 'dream'),
      agent: currentAgent.agentName, // Use 'agent' consistently
      time_frame: entry.time_frame || '',
      dream: entry.dream || '',
      why: entry.why || ''
    };
  });

  console.log('Saving dreams data:', entriesWithAgent);

  // Create payload with proper structure
  const payload = {
    formId: 'dreamsForm',
    agent: currentAgent.agentName, // Use 'agent' consistently
    entries: entriesWithAgent,
    sheetName: 'Dreams List'
  };
  
  const callbackName = 'handleSaveDreamsResponse_' + new Date().getTime();
  
  // Create global callback function
  window[callbackName] = function(response) {
    console.log('Save dreams response:', response);
    
    if (response && response.status === 'success') {
      showToast('Dreams saved successfully!', 'success');
      if (saveStatusElement) {
        saveStatusElement.innerHTML = '<i class="fas fa-check text-green-500 mr-1"></i> Saved';
        setTimeout(() => {
          saveStatusElement.style.opacity = '0';
        }, 3000);
      }
      
      // Reload dreams data to ensure we have the latest from the server
      setTimeout(() => loadDreamsData(), 1000);
    } else {
      console.error('Error saving dreams:', response?.message || 'Unknown error');
      showToast('Error saving dreams: ' + (response?.message || 'Unknown error'), 'error');
      if (saveStatusElement) {
        saveStatusElement.innerHTML = '<i class="fas fa-times text-red-500 mr-1"></i> Error saving';
      }
    }
    
    // Clean up the global callback
    delete window[callbackName];
  };
  
  // Create and append the script element
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=bulkUpdateEntries&data=${encodeURIComponent(JSON.stringify(payload))}`;
  
  console.log('Sending request to save dreams:', script.src);
  
  script.onerror = function() {
    console.error('Failed to save dreams - script loading error');
    showToast('Error saving dreams: Network error', 'error');
    if (saveStatusElement) {
      saveStatusElement.innerHTML = '<i class="fas fa-times text-red-500 mr-1"></i> Error saving';
    }
    delete window[callbackName];
  };
  
  document.head.appendChild(script);
}

// Add event listener for the Save All Dreams button
document.getElementById('saveDreamsBtn').addEventListener('click', function(e) {
  e.preventDefault();
  saveDreamsToServer();
});

// Function to edit a multi-entry item
function editMultiEntry(formId, index) {
  if (formId === 'dreamsForm') {
    const entry = dreamsData[index];
    if (!entry) {
      console.error('Entry not found at index', index);
      return;
    }
    
    // Populate the modal form with the entry data
    document.getElementById('modalDreamRecordId').value = entry.record_id || '';
    
    // Set the dropdown value
    const timeFrameSelect = document.getElementById('modalTimeFrame');
    const timeFrameValue = entry.time_frame || '3 Months';
    
    // Find the option with the matching value
    for (let i = 0; i < timeFrameSelect.options.length; i++) {
      if (timeFrameSelect.options[i].value === timeFrameValue) {
        timeFrameSelect.selectedIndex = i;
        break;
      }
    }
    
    document.getElementById('modalDream').value = entry.dream || '';
    document.getElementById('modalWhy').value = entry.why || '';
    
    // Show the modal
    document.getElementById('dreamEntryModal').classList.add('show');
  }
  // Handle other form types...
}

// Helper function to send JSON data to the server
function sendJsonToServer(data, callback) {
  console.log('Sending JSON data to server:', data);
  
  // Create a unique callback name
  const callbackName = 'handleJsonResponse_' + new Date().getTime();
  
  // Create a global callback function
  window[callbackName] = function(response) {
    console.log('Server response:', response);
    if (callback) {
      callback(response);
    }
    // Clean up the global callback
    delete window[callbackName];
  };
  
  // Create a form to send the data
  const form = document.createElement('form');
  form.method = 'POST';
  form.action = `https://script.google.com/macros/s/${scriptId}/exec`;
  form.target = 'hidden-iframe';
  
  // Add the callback parameter
  const callbackInput = document.createElement('input');
  callbackInput.type = 'hidden';
  callbackInput.name = 'callback';
  callbackInput.value = callbackName;
  form.appendChild(callbackInput);
  
  // Add the data parameter
  const dataInput = document.createElement('input');
  dataInput.type = 'hidden';
  dataInput.name = 'data';
  dataInput.value = JSON.stringify(data);
  form.appendChild(dataInput);
  
  // Create a hidden iframe to receive the response
  let iframe = document.getElementById('hidden-iframe');
  if (!iframe) {
    iframe = document.createElement('iframe');
    iframe.id = 'hidden-iframe';
    iframe.name = 'hidden-iframe';
    iframe.style.display = 'none';
    document.body.appendChild(iframe);
  }
  
  // Submit the form
  document.body.appendChild(form);
  form.submit();
  
  // Clean up the form
  setTimeout(() => {
    document.body.removeChild(form);
  }, 500);
  
  // Set a timeout for the callback in case the server doesn't respond
  setTimeout(() => {
    if (window[callbackName]) {
      console.error('Server did not respond within timeout');
      if (callback) {
        callback({ status: 'error', message: 'Server did not respond within timeout' });
      }
      delete window[callbackName];
    }
  }, 30000); // 30 second timeout
}

function populateCareerProgressionForm(data) {
  console.log('Populating career progression form with data:', data);
  const form = document.getElementById('careerProgressionForm');
  if (!form) {
    console.error('Career progression form not found');
    return;
  }

  // Set record ID
  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    recordIdInput.value = data.record_id || `${currentAgent.agentName}_careerProgressionForm`;
  }

  // Set agent name
  const agentNameInput = form.querySelector('input[name="agentName"]');
  if (agentNameInput) {
    agentNameInput.value = currentAgent.agentName;
  }

  // Populate checkboxes
  const checkboxes = form.querySelectorAll('input[type="checkbox"]');
  checkboxes.forEach(checkbox => {
    const value = data[checkbox.name];
    checkbox.checked = value === true || value === "true";
  });

  // Populate other fields if needed
  // ...
}
