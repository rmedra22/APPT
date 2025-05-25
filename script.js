// Global variables
let currentPage = 'dashboard'; // Default to dashboard
let currentAgent = null; // Stores logged-in agent info
const AUTO_SAVE_DELAY = 2000; // 2 seconds
let autoSaveTimeout = null;
let autoSaveEnabled = true; // New variable to control auto-save feature

// Add role-based access control
function setupRoleBasedAccess() {
  const isAdmin = currentAgent && currentAgent.role === 'admin';
  
  // Hide admin-only elements for regular users
  document.querySelectorAll('.admin-only').forEach(element => {
    element.style.display = isAdmin ? '' : 'none';
  });
  
  // For regular users, only show Field Trainings in the sidebar
  if (!isAdmin) {
    document.querySelectorAll('.sidebar-menu a').forEach(link => {
      const page = link.getAttribute('data-page');
      if (page !== 'dashboard' && 
          page !== 'personal-details-form' && 
          page !== 'potential-field-trainings-form') {
        link.style.display = 'none';
      }
    });
  }
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
const scriptId = 'AKfycbxHbir835yqe4zbSAG0pQtIX_TAQTZJJX6rALp68oCeDwfGGDgNFvUAxLwrhum2nbm_xA'; // Replace with your actual script ID

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
  // First, check if the page exists
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.error(`Error: Page with ID "${pageId}" not found`);
    showToast(`Error: Page not found`, 'error');
    return; // Exit the function if the page doesn't exist
  }

  // Hide all pages and show the target page
  const pages = document.querySelectorAll('.page-content');
  pages.forEach(page => page.classList.add('hidden'));
  targetPage.classList.remove('hidden');

  // Update sidebar active link
  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  sidebarLinks.forEach(link => link.classList.remove('active'));
  
  // Map dashboardPageContent to dashboard for sidebar link selection
  const sidebarPageId = pageId === 'dashboardPageContent' ? 'dashboard' : pageId;
  
  // Add null check before accessing classList
  const activeLink = document.querySelector(`.sidebar-menu a[data-page="${sidebarPageId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  } else {
    console.warn(`No sidebar link found for page: ${pageId} (looking for ${sidebarPageId})`);
  }

  currentPage = pageId; // Update current page global variable
  console.log(`Navigated to: ${pageId}`);

  // Load data specific to the form - force reload from server
  const formId = pageId.replace('-form', '');
  if (formSheetMap[formId]) {
    console.log(`Loading data for ${formId} after navigation`);
    loadFormData(formId, true); // true = skip cache
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
  
  // Hide sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('mainContent').classList.add('full-width');
  }
}

// --- Form Data Handling ---

// Save form data to Google Sheet
function saveFormData(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
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

  // Convert FormData to a regular object
  const fields = {};
  for (let [key, value] of formData.entries()) {
    if (key === 'amount' && formId === 'expensesForm') {
      fields[key] = parseCurrency(value); // Parse currency for expenses
    } else {
      fields[key] = value;
    }
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

  const payload = {
    action: 'saveData', // This action is handled by doPost in Code.gs
    sheetName: sheetName,
    record_id: recordId,
    fields: fields
  };

  console.log('Saving data with payload:', payload);

  fetch(`https://script.google.com/macros/s/${scriptId}/exec`, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    console.log('Form data sent (no-cors response):', response);
    showToast('Data saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    // For single-entry forms, reload the data to ensure UI is updated
    if (!['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
        loadFormData(formId);
    }
  })
  .catch(error => {
    console.error('Error saving form data:', error);
    showToast('Error saving data. Please try again.', 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
  });
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
      
      // If the form doesn't have a record_id yet, set it to the consistent format
      const recordIdInput = document.querySelector(`#${formId} input[name="record_id"]`);
      if (recordIdInput && !recordIdInput.value) {
        recordIdInput.value = `${currentAgent.agentName}_${formId}`;
      }
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
  console.log(`Populating ${formId} with data:`, data);
  const form = document.getElementById(formId);
  if (!form) {
    console.error(`Form with ID ${formId} not found`);
    return;
  }

  // Populate all form fields
  for (const key in data) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      if (input.type === 'date' && data[key]) {
        // Format date string to YYYY-MM-DD for date input
        try {
          const date = new Date(data[key]);
          if (!isNaN(date.getTime())) {
            input.value = date.toISOString().split('T')[0];
          }
        } catch (e) {
          console.error(`Error formatting date for ${key}:`, e);
        }
      } else if (input.type === 'checkbox') {
        // For checkboxes, check if the value is 'Yes'
        input.checked = data[key] === 'Yes';
      } else {
        // For all other input types
        input.value = data[key] || '';
      }
    }
  }
  
  // For personalForm, add special handling
  if (formId === 'personalForm') {
    // Make sure record_id is set
    const recordIdInput = form.querySelector('input[name="record_id"]');
    if (recordIdInput && !recordIdInput.value && currentAgent) {
      recordIdInput.value = `${currentAgent.agentName}_personalForm`;
    }
    
    // Add blur event listeners to each field
    const inputs = form.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      // Skip the record_id field
      if (input.name === 'record_id') return;
      
      // Add blur event listener
      input.addEventListener('blur', function() {
        // Only save if auto-save is enabled and the field has a value
        if (autoSaveEnabled && input.value.trim() !== '') {
          console.log(`Field ${input.name} lost focus with value: ${input.value}`);
          // Small delay to allow for focus to move to another field
          setTimeout(() => {
            saveFormData('personalForm');
          }, 300);
        }
      });
    });
  }
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
    } else if (formId === 'partnersForm') {
      row.insertCell().textContent = entry.name || '';
      row.insertCell().textContent = entry.contact || '';
      row.insertCell().textContent = entry.email || '';
      row.insertCell().textContent = entry.status || '';
      row.insertCell().textContent = entry.notes || '';
      
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
    } else if (formId === 'clientsForm') { // Field Trainings
      row.insertCell().textContent = entry.client_name || '';
      row.insertCell().textContent = entry.date ? new Date(entry.date).toLocaleDateString() : '';
      row.insertCell().textContent = entry.type_of_training || '';
      row.insertCell().textContent = entry.outcome || '';
      row.insertCell().textContent = entry.notes || '';
      
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
  
  console.log(`Table for ${formId} rendered with ${entries.length} rows`);
}

function attachMultiEntryTableListeners(formId) {
  const tableBody = document.querySelector(`#${formId} .data-table tbody`);
  if (!tableBody) return;

  // Clear previous listeners to prevent duplicates
  tableBody.removeEventListener('click', handleTableButtonClick);
  tableBody.addEventListener('click', handleTableButtonClick);
}

function handleTableButtonClick(event) {
  const target = event.target.closest('button');
  if (!target) return;

  const formId = target.dataset.formId;
  const index = parseInt(target.dataset.index);

  if (target.classList.contains('edit-btn')) {
    editMultiEntry(formId, index);
  } else if (target.classList.contains('delete-btn')) {
    deleteMultiEntry(formId, index);
  }
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.add('show');
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.classList.remove('show');
    // Clear form inside modal when closing
    const form = modal.querySelector('form');
    if (form) form.reset();
  }
}

function editMultiEntry(formId, index) {
  const tableBody = document.querySelector(`#${formId} .data-table tbody`);
  const row = tableBody.rows[index];
  if (!row) return;

  const currentEntries = JSON.parse(localStorage.getItem(`${formId}_entries`)) || [];
  const entryToEdit = currentEntries[index];

  if (!entryToEdit) {
    showToast('Error: Entry not found for editing.', 'error');
    return;
  }

  let modalId = '';
  let modalFormId = '';
  let recordIdInputId = '';

  if (formId === 'dreamsForm') {
    modalId = 'dreamEntryModal';
    modalFormId = 'modalDreamForm';
    recordIdInputId = 'modalDreamRecordId';
    document.getElementById('modalTimeFrame').value = entryToEdit.time_frame || '';
    document.getElementById('modalDream').value = entryToEdit.dream || '';
    document.getElementById('modalWhy').value = entryToEdit.why || '';
  } else if (formId === 'expensesForm') {
    modalId = 'expenseEntryModal';
    modalFormId = 'modalExpenseForm';
    recordIdInputId = 'modalExpenseRecordId';
    document.getElementById('modalItem').value = entryToEdit.item || '';
    document.getElementById('modalAmount').value = formatCurrency(entryToEdit.amount);
    document.getElementById('modalCategory').value = entryToEdit.category || '';
    document.getElementById('modalExpenseDate').value = entryToEdit.date ? new Date(entryToEdit.date).toISOString().split('T')[0] : '';
    document.getElementById('modalDescription').value = entryToEdit.description || '';
    setupCurrencyInput(document.getElementById('modalAmount')); // Re-apply currency input for modal
  } else if (formId === 'partnersForm') {
    modalId = 'partnerEntryModal';
    modalFormId = 'modalPartnerForm';
    recordIdInputId = 'modalPartnerRecordId';
    document.getElementById('modalPartnerName').value = entryToEdit.name || '';
    document.getElementById('modalPartnerContact').value = entryToEdit.contact || '';
    document.getElementById('modalPartnerEmail').value = entryToEdit.email || '';
    document.getElementById('modalPartnerStatus').value = entryToEdit.status || '';
    document.getElementById('modalPartnerNotes').value = entryToEdit.notes || '';
  } else if (formId === 'clientsForm') { // Field Trainings
    modalId = 'clientEntryModal';
    modalFormId = 'modalClientForm';
    recordIdInputId = 'modalClientRecordId';
    document.getElementById('modalClientName').value = entryToEdit.client_name || '';
    document.getElementById('modalClientDate').value = entryToEdit.date ? new Date(entryToEdit.date).toISOString().split('T')[0] : '';
    document.getElementById('modalClientType').value = entryToEdit.type_of_training || '';
    document.getElementById('modalClientOutcome').value = entryToEdit.outcome || '';
    document.getElementById('modalClientNotes').value = entryToEdit.notes || '';
  }

  // Set the record_id for the modal form
  document.getElementById(recordIdInputId).value = entryToEdit.record_id;
  document.getElementById(recordIdInputId).dataset.originalIndex = index; // Store original index

  openModal(modalId);
}

function saveModalEntry(formId) {
  const sheetName = formSheetMap[formId];
  if (!currentAgent || !currentAgent.agentName || !sheetName) {
    showToast('Login required or invalid form context.', 'error');
    return;
  }

  // Remove showLoading() call

  let modalId = '';
  let modalFormId = '';
  let recordIdInputId = '';

  if (formId === 'dreamsForm') {
    modalId = 'dreamEntryModal';
    modalFormId = 'modalDreamForm';
    recordIdInputId = 'modalDreamRecordId';
  } else if (formId === 'expensesForm') {
    modalId = 'expenseEntryModal';
    modalFormId = 'modalExpenseForm';
    recordIdInputId = 'modalExpenseRecordId';
  } else if (formId === 'partnersForm') {
    modalId = 'partnerEntryModal';
    modalFormId = 'modalPartnerForm';
    recordIdInputId = 'modalPartnerRecordId';
  } else if (formId === 'clientsForm') { // Field Trainings
    modalId = 'clientEntryModal';
    modalFormId = 'modalClientForm';
    recordIdInputId = 'modalClientRecordId';
  }

  const form = document.getElementById(modalFormId);
  const formData = new FormData(form);
  
  let recordId = document.getElementById(recordIdInputId).value;
  const originalIndex = document.getElementById(recordIdInputId).dataset.originalIndex;

  // If it's a new entry, generate a new record_id
  if (!recordId) {
      recordId = generateRecordId(currentAgent.agentName, formId);
      document.getElementById(recordIdInputId).value = recordId;
  }

  const newEntry = { record_id: recordId, agent: currentAgent.agentName }; // Always include record_id and agent
  for (let [key, value] of formData.entries()) {
    if (key !== 'record_id') { // Don't re-add record_id from formData
      if (key === 'amount' && formId === 'expensesForm') {
        newEntry[key] = parseCurrency(value); // Parse currency for expenses
      } else {
        newEntry[key] = value;
      }
    }
  }

  let currentEntries = JSON.parse(localStorage.getItem(`${formId}_entries`)) || [];

  if (originalIndex !== undefined && currentEntries[originalIndex] && currentEntries[originalIndex].record_id === recordId) {
    // Update existing entry
    currentEntries[originalIndex] = newEntry;
    showToast('Entry updated in local storage.', 'info');
  } else {
    // Add new entry
    currentEntries.push(newEntry);
    showToast('New entry added to local storage.', 'info');
  }

  localStorage.setItem(`${formId}_entries`, JSON.stringify(currentEntries));
  renderMultiEntryTable(formId, currentEntries);
  closeModal(modalId);
}

function deleteMultiEntry(formId, index) {
  if (!confirm('Are you sure you want to delete this entry?')) {
    return;
  }

  let currentEntries = JSON.parse(localStorage.getItem(`${formId}_entries`)) || [];
  if (index >= 0 && index < currentEntries.length) {
    currentEntries.splice(index, 1); // Remove the entry
    localStorage.setItem(`${formId}_entries`, JSON.stringify(currentEntries));
    showToast('Entry deleted from local storage.', 'success');
    renderMultiEntryTable(formId, currentEntries); // Re-render the table
  } else {
    showToast('Error: Entry not found for deletion.', 'error');
  }
}

function bulkSaveMultiEntryForm(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
    return;
  }

  showToast('Saving all entries...', 'info');
  
  const sheetName = formSheetMap[formId];
  const saveStatusElementId = `${formId}SaveStatus`;
  const entriesToSave = JSON.parse(localStorage.getItem(`${formId}_entries`)) || [];

  if (!sheetName) {
    showToast('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  updateSaveStatus('Saving all entries...', saveStatusElementId);

  const payload = {
    action: 'bulkUpdateEntries', // New action for bulk updates
    sheetName: sheetName,
    agent: currentAgent.agentName,
    formId: formId, // Pass formId for server-side mapping to sheetName
    entries: entriesToSave // Array of all entries for the current agent
  };

  console.log('Bulk save payload:', payload);

  fetch(`https://script.google.com/macros/s/${scriptId}/exec`, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    console.log('Bulk data sent (no-cors response):', response);
    showToast('All entries saved successfully!', 'success');
    updateSaveStatus('All Saved!', saveStatusElementId);
    
    // After successful save, reload from server to ensure local storage is in sync
    setTimeout(() => {
      loadFormData(formId, true); // Force skip cache
    }, 2000); // Wait 2 seconds to ensure server has processed the data
  })
  .catch(error => {
    console.error('Error saving bulk data:', error);
    showToast('Error saving all entries: ' + error.message, 'error');
    updateSaveStatus('Error saving all!', saveStatusElementId);
  });
}


// --- Login / Logout Functions ---

function handleLogin(event) {
  event.preventDefault();
  const agentName = document.getElementById('agentName').value;
  const password = document.getElementById('password').value;
  const loginError = document.getElementById('loginError');
  
  if (!agentName || !password) {
    loginError.textContent = 'Please enter both agent name and password.';
    loginError.style.display = 'block';
    return;
  }

  console.log('Attempting login for agent:', agentName);
  loginError.style.display = 'none';

  const callbackName = 'handleLoginResponse';
  window[callbackName] = function(response) {
    console.log('Login Response:', response);
    if (!response.error) {
      currentAgent = response;
      localStorage.setItem('currentAgent', JSON.stringify(currentAgent));
      showDashboard();
      initSheets(); // Ensure sheets are created on successful login
      
      // Add a delay to ensure the DOM is fully updated
      setTimeout(checkAndFixSidebarDisplay, 500);
    } else {
      loginError.textContent = response.error;
      loginError.style.display = 'block';
    }
  };

  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=login&agent=${encodeURIComponent(agentName)}&password=${encodeURIComponent(password)}`;
  document.head.appendChild(script);
}

function handleLogout() {
  if (confirm('Are you sure you want to log out?')) {
    // Remove showLoading() call
    localStorage.removeItem('currentAgent');
    currentAgent = null;
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
    document.getElementById('loginForm').reset();
    document.getElementById('loginError').style.display = 'none';
    // Remove hideLoading() call
  }
}




function showDashboard() {
  document.getElementById('loginPage').classList.add('hidden');
  document.getElementById('dashboardPage').classList.remove('hidden');
  
  // Update agent name and role in sidebar and header
  if (currentAgent && !currentAgent.error && !currentAgent.status) {
    console.log('Setting up dashboard for agent:', currentAgent);
    
    // Update agent name display
    const agentNameDisplay = document.getElementById('agentNameDisplay');
    if (agentNameDisplay) {
      agentNameDisplay.textContent = currentAgent.agentName || 'Unknown';
    } else {
      console.error('Agent name display element not found');
    }
    
    // Update header agent name
    const headerAgentName = document.getElementById('headerAgentName');
    if (headerAgentName) {
      headerAgentName.textContent = currentAgent.agentName || 'Unknown';
    } else {
      console.error('Header agent name element not found');
    }
    
    // Update agent role display
    const agentRoleDisplay = document.getElementById('agentRoleDisplay');
    if (agentRoleDisplay) {
      agentRoleDisplay.textContent = currentAgent.role || 'user';
    } else {
      console.error('Agent role display element not found');
    }
    
    // Update agent avatar
    const agentAvatar = document.getElementById('agentAvatar');
    if (agentAvatar) {
      if (currentAgent.avatarUrl) {
        agentAvatar.src = currentAgent.avatarUrl;
      } else {
        // Generate avatar from name if no avatar URL is provided
        const name = encodeURIComponent(currentAgent.agentName || 'User');
        agentAvatar.src = `https://ui-avatars.com/api/?name=${name}&background=random`;
      }
    } else {
      console.error('Agent avatar element not found');
    }
  } else {
    console.error('Current agent is null, undefined, or has an error:', currentAgent);
    // Handle error case - redirect to login
    if (currentAgent && (currentAgent.error || currentAgent.status === 'error')) {
      showToast('Login error: ' + (currentAgent.error || currentAgent.message || 'Unknown error'), 'error');
      setTimeout(() => {
        handleLogout();
      }, 2000);
      return;
    }
  }
  
  // Set up role-based access control
  setupRoleBasedAccess();
  
  // Navigate to dashboard by default
  if (document.getElementById('dashboardPageContent')) {
    navigateTo('dashboardPageContent');
  } else if (document.getElementById('dashboard')) {
    navigateTo('dashboard');
  } else {
    console.error('Dashboard page not found');
    // Try to navigate to the first visible page
    const firstPage = document.querySelector('.page-content');
    if (firstPage) {
      navigateTo(firstPage.id);
    }
  }
  
  console.log('Dashboard shown for agent:', currentAgent);
}

// Function to update date and time in header
function updateDateTime() {
  const dateElement = document.getElementById('currentDate');
  const timeElement = document.getElementById('currentTime');
  
  if (dateElement && timeElement) {
    const now = new Date();
    
    // Format date: Monday, January 1, 2023
    const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    dateElement.textContent = now.toLocaleDateString('en-US', dateOptions);
    
    // Format time: 12:00:00 PM
    const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true };
    timeElement.textContent = now.toLocaleTimeString('en-US', timeOptions);
    }
}

// --- Event Listeners ---
document.addEventListener('DOMContentLoaded', function() {
  // Log all page-content elements to help debug
  console.log('Available pages:');
  document.querySelectorAll('.page-content').forEach(page => {
    console.log(`- ${page.id}`);
  });

  updateDateTime(); // Initial call
  setInterval(updateDateTime, 1000); // Update every second

  // Check for existing login session
  const storedAgent = localStorage.getItem('currentAgent');
  if (storedAgent) {
    currentAgent = JSON.parse(storedAgent);
    showDashboard();
    // No need to initSheets again here, as it's called on first successful login
    // or when explicitly run via the init parameter in doGet
  } else {
    document.getElementById('loginPage').classList.remove('hidden');
    document.getElementById('dashboardPage').classList.add('hidden');
  }

  // Login Form Submission
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Logout Button
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }

  // Sidebar navigation
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const page = this.getAttribute('data-page');
      
      // Check if the page exists before navigating
      const pageId = page === 'dashboard' ? 'dashboardPageContent' : page;
      if (document.getElementById(pageId)) {
        navigateTo(pageId);
      } else {
        console.error(`Page with ID "${pageId}" not found`);
        showToast(`Error: Page not found`, 'error');
      }
    });
  });
  
  // Call this function early
  disableAllLoadingIndicators();

  // Menu Toggle for mobile
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  if (menuToggle) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      mainContent.classList.toggle('full-width');
    });
  }

  // Auto-save for single-entry forms
  const singleEntryForms = ['personalForm', 'progressionsForm'];
  singleEntryForms.forEach(formId => {
    const form = document.getElementById(formId);
    if (form) {
      form.addEventListener('input', function() {
        if (!autoSaveEnabled) return; // Skip if auto-save is disabled
        
        clearTimeout(autoSaveTimeout);
        updateSaveStatus('Saving...', `${formId}SaveStatus`);
        autoSaveTimeout = setTimeout(() => saveFormData(formId), AUTO_SAVE_DELAY);
      });
      
      // Also attach a submit listener for manual save
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        clearTimeout(autoSaveTimeout); // Clear auto-save if manually submitting
        saveFormData(formId);
      });
    }
  });

  // Auto-save/submit for multi-entry forms (within modals)
  // For multi-entry forms, the entries are first saved to local storage
  // and then a bulk save button is used to push all to Google Sheet.

  // Dreams List Modals and Buttons
  const dreamEntryModal = document.getElementById('dreamEntryModal');
  const closeDreamModal = document.getElementById('closeDreamModal');
  const addDreamEntryBtn = document.getElementById('addDreamEntryBtn');
  const saveModalDreamBtn = document.getElementById('saveModalDreamBtn');
  const saveDreamsBtn = document.getElementById('saveDreamsBtn');

  if (addDreamEntryBtn) addDreamEntryBtn.addEventListener('click', () => {
    openModal('dreamEntryModal');
    document.getElementById('modalDreamForm').reset(); // Clear form for new entry
    document.getElementById('modalDreamRecordId').value = ''; // Ensure no record ID for new
    document.getElementById('modalDreamRecordId').dataset.originalIndex = ''; // Clear original index
  });
  if (closeDreamModal) closeDreamModal.addEventListener('click', () => closeModal('dreamEntryModal'));
  if (dreamEntryModal) dreamEntryModal.addEventListener('click', (e) => { // Close when clicking outside
    if (e.target === dreamEntryModal) closeModal('dreamEntryModal');
  });
  if (saveModalDreamBtn) saveModalDreamBtn.addEventListener('click', () => saveModalEntry('dreamsForm'));
  if (saveDreamsBtn) saveDreamsBtn.addEventListener('click', () => bulkSaveMultiEntryForm('dreamsForm'));


  // Expenses Modals and Buttons
  const expenseEntryModal = document.getElementById('expenseEntryModal');
  const closeExpenseModal = document.getElementById('closeExpenseModal');
  const addExpenseEntryBtn = document.getElementById('addExpenseEntryBtn');
  const saveModalExpenseBtn = document.getElementById('saveModalExpenseBtn');
  const saveExpensesBtn = document.getElementById('saveExpensesBtn');

  if (addExpenseEntryBtn) addExpenseEntryBtn.addEventListener('click', () => {
    openModal('expenseEntryModal');
    document.getElementById('modalExpenseForm').reset();
    document.getElementById('modalExpenseRecordId').value = '';
    document.getElementById('modalExpenseRecordId').dataset.originalIndex = '';
    setupCurrencyInput(document.getElementById('modalAmount')); // Init for new entry
  });
  if (closeExpenseModal) closeExpenseModal.addEventListener('click', () => closeModal('expenseEntryModal'));
  if (expenseEntryModal) expenseEntryModal.addEventListener('click', (e) => { // Close when clicking outside
    if (e.target === expenseEntryModal) closeModal('expenseEntryModal');
  });
  if (saveModalExpenseBtn) saveModalExpenseBtn.addEventListener('click', () => saveModalEntry('expensesForm'));
  if (saveExpensesBtn) saveExpensesBtn.addEventListener('click', () => bulkSaveMultiEntryForm('expensesForm'));

  // Potential Business Partners Modals and Buttons
  const partnerEntryModal = document.getElementById('partnerEntryModal');
  const closePartnerModal = document.getElementById('closePartnerModal');
  const addPartnerEntryBtn = document.getElementById('addPartnerEntryBtn');
  const saveModalPartnerBtn = document.getElementById('saveModalPartnerBtn');
  const savePartnersBtn = document.getElementById('savePartnersBtn');

  if (addPartnerEntryBtn) addPartnerEntryBtn.addEventListener('click', () => {
    openModal('partnerEntryModal');
    document.getElementById('modalPartnerForm').reset();
    document.getElementById('modalPartnerRecordId').value = '';
    document.getElementById('modalPartnerRecordId').dataset.originalIndex = '';
  });
  if (closePartnerModal) closePartnerModal.addEventListener('click', () => closeModal('partnerEntryModal'));
  if (partnerEntryModal) partnerEntryModal.addEventListener('click', (e) => {
    if (e.target === partnerEntryModal) closeModal('partnerEntryModal');
  });
  if (saveModalPartnerBtn) saveModalPartnerBtn.addEventListener('click', () => saveModalEntry('partnersForm'));
  if (savePartnersBtn) savePartnersBtn.addEventListener('click', () => bulkSaveMultiEntryForm('partnersForm'));

  // Potential Field Trainings Modals and Buttons
  const clientEntryModal = document.getElementById('clientEntryModal');
  const closeClientModal = document.getElementById('closeClientModal');
  const addClientEntryBtn = document.getElementById('addClientEntryBtn');
  const saveModalClientBtn = document.getElementById('saveModalClientBtn');
  const saveClientsBtn = document.getElementById('saveClientsBtn');

  if (addClientEntryBtn) addClientEntryBtn.addEventListener('click', () => {
    openModal('clientEntryModal');
    document.getElementById('modalClientForm').reset();
    document.getElementById('modalClientRecordId').value = '';
    document.getElementById('modalClientRecordId').dataset.originalIndex = '';
  });
  if (closeClientModal) closeClientModal.addEventListener('click', () => closeModal('clientEntryModal'));
  if (clientEntryModal) clientEntryModal.addEventListener('click', (e) => {
    if (e.target === clientEntryModal) closeModal('clientEntryModal');
  });
  if (saveModalClientBtn) saveModalClientBtn.addEventListener('click', () => saveModalEntry('clientsForm'));
  if (saveClientsBtn) saveClientsBtn.addEventListener('click', () => bulkSaveMultiEntryForm('clientsForm'));

  // Add event listener for create user form
  const createUserForm = document.getElementById('createUserForm');
  if (createUserForm) {
    createUserForm.addEventListener('submit', createUser);
  }
  
  // Add event listener for user management page
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const page = this.getAttribute('data-page');
      
      // Load users when navigating to user management
      if (page === 'user-management-form') {
        loadUsers();
      }
      
      navigateTo(page + (page === 'dashboard' ? 'PageContent' : ''));
    });
  });
});

// Call this function when the page loads to fix monthly income if it's there.
// This is not directly related to tab creation but good practice for currency inputs.
function fixMonthlyIncomeInput() {
  const incomeInput = document.getElementById('monthlyIncome');
  if (!incomeInput) return;
  
  // If it's already a text input, no need to change
  if (incomeInput.type !== 'number') return;
  
  // Get the current value
  const currentValue = incomeInput.value;
  
  // Create a new text input to replace the number input
  const newInput = document.createElement('input');
  newInput.type = 'text';
  newInput.id = 'monthlyIncome';
  newInput.name = 'monthly_income';
  newInput.className = incomeInput.className;
  
  // Set the value and add event listeners
  if (currentValue) {
    newInput.value = formatCurrency(parseFloat(currentValue));
  }
  
  // Replace the old input with the new one
  incomeInput.parentNode.replaceChild(newInput, incomeInput);
  
  // Setup currency formatting
  setupCurrencyInput(newInput);
}

// Call this function when the page loads
document.addEventListener('DOMContentLoaded', function() {
  // fixMonthlyIncomeInput(); // Call this if you have a monthlyIncome field in your form
});

// Add this function to completely disable any loading indicators
function disableAllLoadingIndicators() {
  // Override any loading functions with empty functions
  window.showLoading = function() {};
  window.hideLoading = function() {};
  
  // Remove any loading overlay elements
  const loadingElements = document.querySelectorAll('[id*="loading"], [class*="loading"]');
  loadingElements.forEach(el => {
    if (el.id.toLowerCase().includes('loading') || 
        (el.className && el.className.toLowerCase().includes('loading'))) {
      el.style.display = 'none';
    }
  });
}

// Call this function early
disableAllLoadingIndicators();

// Add user management functions
function loadUsers() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    return;
  }
  
  const callbackName = 'handleGetUsersResponse';
  window[callbackName] = function(response) {
    console.log('Get Users Response:', response);
    if (response.status === 'success' && response.users) {
      renderUsersTable(response.users);
    } else {
      showToast('Error loading users: ' + response.message, 'error');
    }
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getUsers`;
  document.head.appendChild(script);
}

function renderUsersTable(users) {
  const tableBody = document.querySelector('#usersTable tbody');
  tableBody.innerHTML = '';
  
  users.forEach(user => {
    const row = tableBody.insertRow();
    
    row.insertCell().textContent = user.agentName;
    row.insertCell().textContent = user.role || 'user';
    row.insertCell().textContent = user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : 'N/A';
    
    const actionsCell = row.insertCell();
    const deleteButton = document.createElement('button');
    deleteButton.className = 'btn-delete';
    deleteButton.innerHTML = '<i class="fas fa-trash"></i>';
    deleteButton.onclick = function() { deleteUser(user.agentName); };
    
    const resetButton = document.createElement('button');
    resetButton.className = 'btn-edit ml-2';
    resetButton.innerHTML = '<i class="fas fa-key"></i>';
    resetButton.onclick = function() { resetUserPassword(user.agentName); };
    
    actionsCell.appendChild(deleteButton);
    actionsCell.appendChild(resetButton);
  });
}

function createUser(event) {
  event.preventDefault();
  
  if (!currentAgent || currentAgent.role !== 'admin') {
    showToast('Admin access required.', 'error');
    return;
  }
  
  const form = document.getElementById('createUserForm');
  const formData = new FormData(form);
  const userData = {};
  
  for (let [key, value] of formData.entries()) {
    userData[key] = value;
  }
  
  // Add timestamp
  userData.lastUpdated = new Date().toISOString();
  
  const callbackName = 'handleCreateUserResponse';
  window[callbackName] = function(response) {
    console.log('Create User Response:', response);
    if (response.status === 'success') {
      showToast('User created successfully!', 'success');
      form.reset();
      loadUsers(); // Reload the user list
    } else {
      showToast('Error creating user: ' + response.message, 'error');
    }
  };
  
  // Log the data being sent for debugging
  console.log('Creating user with data:', userData);
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=createUser&data=${encodeURIComponent(JSON.stringify(userData))}`;
  document.head.appendChild(script);
}

function deleteUser(agentName) {
  if (!confirm(`Are you sure you want to delete user "${agentName}"?`)) {
    return;
  }
  
  if (!currentAgent || currentAgent.role !== 'admin') {
    showToast('Admin access required.', 'error');
    return;
  }
  
  const callbackName = 'handleDeleteUserResponse';
  window[callbackName] = function(response) {
    console.log('Delete User Response:', response);
    if (response.status === 'success') {
      showToast('User deleted successfully!', 'success');
      loadUsers(); // Reload the user list
    } else {
      showToast('Error deleting user: ' + response.message, 'error');
    }
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=deleteUser&agentName=${encodeURIComponent(agentName)}`;
  document.head.appendChild(script);
}

function resetUserPassword(agentName) {
  const newPassword = prompt(`Enter new password for user "${agentName}":`);
  if (!newPassword) {
    return;
  }
  
  if (!currentAgent || currentAgent.role !== 'admin') {
    showToast('Admin access required.', 'error');
    return;
  }
  
  const callbackName = 'handleResetPasswordResponse';
  window[callbackName] = function(response) {
    console.log('Reset Password Response:', response);
    if (response.status === 'success') {
      showToast('Password reset successfully!', 'success');
    } else {
      showToast('Error resetting password: ' + response.message, 'error');
    }
  };
  
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=resetPassword&agentName=${encodeURIComponent(agentName)}&password=${encodeURIComponent(newPassword)}`;
  document.head.appendChild(script);
}

// Add this function to load all personal details for admin
function loadAllPersonalDetails() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    return;
  }
  
  console.log('Loading all personal details for admin');
  showToast('Loading personal details...', 'info');
  
  const callbackName = 'handleGetAllPersonalDetailsResponse';
  window[callbackName] = function(response) {
    console.log('Get All Personal Details Response:', response);
    if (response.status === 'success' && response.entries) {
      console.log(`Received ${response.entries.length} personal detail entries`);
      renderAllPersonalDetailsTable(response.entries);
      showToast(`Loaded ${response.entries.length} personal detail records`, 'success');
    } else {
      console.error('Error loading personal details:', response.message || 'Unknown error');
      showToast('Error loading personal details: ' + (response.message || 'Unknown error'), 'error');
    }
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getAllPersonalDetails&t=${timestamp}`;
  
  // Add error handling
  script.onerror = function() {
    console.error('Failed to load personal details - script loading error');
    showToast('Error loading personal details: Network error', 'error');
  };
  
  document.head.appendChild(script);
  console.log('Sent request to load all personal details');
}

// Render the personal details table for admin
function renderAllPersonalDetailsTable(entries) {
  const tableBody = document.querySelector('#allPersonalDetailsTable tbody');
  if (!tableBody) {
    console.error('Personal details table body not found');
    return;
  }
  
  console.log('Rendering personal details table with entries:', entries);
  tableBody.innerHTML = '';
  
  if (!entries || entries.length === 0) {
    const row = tableBody.insertRow();
    const cell = row.insertCell();
    cell.colSpan = 9; // 9 columns total (no Agent Name column)
    cell.textContent = 'No personal details found.';
    cell.style.textAlign = 'center';
    cell.style.padding = '20px';
    console.log('No entries to display in personal details table');
    return;
  }
  
  entries.forEach((entry, index) => {
    console.log(`Rendering entry ${index}:`, entry);
    const row = tableBody.insertRow();
    
    // Helper function to safely get text content
    const safeText = (value) => {
      if (value === null || value === undefined) return '';
      return String(value);
    };
    
    // Name column is kept, Agent Name column is removed
    row.insertCell().textContent = safeText(entry.name);
    row.insertCell().textContent = safeText(entry.agent_id);
    row.insertCell().textContent = safeText(entry.state);
    row.insertCell().textContent = safeText(entry.npn);
    row.insertCell().textContent = safeText(entry.number);
    row.insertCell().textContent = safeText(entry.email);
    row.insertCell().textContent = safeText(entry.children);
    
    // Format exam date if it exists
    const examDateCell = row.insertCell();
    if (entry.exam_date) {
      try {
        const date = new Date(entry.exam_date);
        if (!isNaN(date.getTime())) {
          examDateCell.textContent = date.toLocaleDateString();
        } else {
          examDateCell.textContent = safeText(entry.exam_date);
        }
      } catch (e) {
        console.error('Error formatting date:', e);
        examDateCell.textContent = safeText(entry.exam_date);
      }
    }
    
    const actionsCell = row.insertCell();
    const viewBtn = document.createElement('button');
    viewBtn.className = 'btn-edit';
    viewBtn.innerHTML = '<i class="fas fa-eye"></i>';
    viewBtn.onclick = function() { 
      const agentName = entry.agentname || entry.agent;
      console.log(`View details clicked for agent: ${agentName}`);
      viewPersonalDetails(agentName); 
    };
    
    actionsCell.appendChild(viewBtn);
  });
  
  console.log(`Personal details table rendered with ${entries.length} rows`);
}

// View personal details for a specific agent
function viewPersonalDetails(agentName) {
  if (!currentAgent || currentAgent.role !== 'admin') {
    return;
  }
  
  const callbackName = 'handleGetAgentPersonalDetailsResponse';
  window[callbackName] = function(response) {
    console.log('Get Agent Personal Details Response:', response);
    if (response && !response.error) {
      showPersonalDetailsModal(response);
    } else {
      showToast('Error loading agent details: ' + (response.error || 'Unknown error'), 'error');
    }
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getAgentPersonalDetails&agent=${encodeURIComponent(agentName)}&t=${timestamp}`;
  document.head.appendChild(script);
}

// Show personal details in a modal
function showPersonalDetailsModal(details) {
  // Create a modal to display the details
  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  
  const modalContent = document.createElement('div');
  modalContent.className = 'modal-content';
  
  const closeButton = document.createElement('button');
  closeButton.className = 'modal-close-button';
  closeButton.innerHTML = '&times;';
  closeButton.onclick = function() {
    document.body.removeChild(modal);
  };
  
  const title = document.createElement('h3');
  title.className = 'card-title mb-4';
  title.textContent = 'Personal Details for ' + (details.name || details.agentname || details.agent || 'Agent');
  
  const detailsContainer = document.createElement('div');
  detailsContainer.className = 'grid grid-cols-2 gap-4';
  
  // Add each detail to the container
  const fields = [
   
    { label: 'Agent ID', key: 'agent_id' },
    { label: 'State', key: 'state' },
    { label: 'NPN', key: 'npn' },
    { label: 'Number', key: 'number' },
    { label: 'Email', key: 'email' },
    { label: 'Children', key: 'children' },
    { label: 'Exam Date', key: 'exam_date' }
  ];
  
  fields.forEach(field => {
    const fieldContainer = document.createElement('div');
    
    const label = document.createElement('strong');
    label.textContent = field.label + ': ';
    
    const value = document.createElement('span');
    // Format date fields
    if (field.key === 'exam_date' && details[field.key]) {
      try {
        const date = new Date(details[field.key]);
        if (!isNaN(date.getTime())) {
          value.textContent = date.toLocaleDateString();
        } else {
          value.textContent = details[field.key] || 'N/A';
        }
      } catch (e) {
        value.textContent = details[field.key] || 'N/A';
      }
    } else {
      value.textContent = details[field.key] || 'N/A';
    }
    
    fieldContainer.appendChild(label);
    fieldContainer.appendChild(value);
    detailsContainer.appendChild(fieldContainer);
  });
  
  modalContent.appendChild(closeButton);
  modalContent.appendChild(title);
  modalContent.appendChild(detailsContainer);
  modal.appendChild(modalContent);
  document.body.appendChild(modal);
}

// Add a function to manually refresh the personal details table
function refreshPersonalDetails() {
  if (currentAgent && currentAgent.role === 'admin') {
    loadAllPersonalDetails();
    showToast('Refreshing all personal details...', 'info');
  } else {
    loadPersonalDetails();
    showToast('Refreshing your personal details...', 'info');
  }
}

// Add this to document ready or initialization
document.addEventListener('DOMContentLoaded', function() {
  // Add refresh button to personal details page
  const personalDetailsPage = document.getElementById('personal-details-form');
  if (personalDetailsPage) {
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-secondary mb-4';
    refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh Data';
    refreshButton.onclick = refreshPersonalDetails;
    
    // Insert after the page description
    const pageDescription = personalDetailsPage.querySelector('.page-description');
    if (pageDescription && pageDescription.parentNode) {
      pageDescription.parentNode.insertBefore(refreshButton, pageDescription.nextSibling);
    }
  }
});

// Add this function to check and fix the sidebar display
function checkAndFixSidebarDisplay() {
  console.log('Checking sidebar display...');
  
  if (!currentAgent) {
    console.error('No current agent found');
    return;
  }
  
  // Check if sidebar elements exist and update them
  const agentNameDisplay = document.getElementById('agentNameDisplay');
  const agentRoleDisplay = document.getElementById('agentRoleDisplay');
  const agentAvatar = document.getElementById('agentAvatar');
  
  if (agentNameDisplay) {
    if (agentNameDisplay.textContent === 'Agent Name' || !agentNameDisplay.textContent.trim()) {
      console.log('Fixing agent name display');
      agentNameDisplay.textContent = currentAgent.agentName || 'Unknown';
    }
  }
  
  if (agentRoleDisplay) {
    if (agentRoleDisplay.textContent === 'Role' || !agentRoleDisplay.textContent.trim()) {
      console.log('Fixing agent role display');
      agentRoleDisplay.textContent = currentAgent.role || 'user';
    }
  }
  
  if (agentAvatar) {
    if (agentAvatar.src.includes('ui-avatars.com/api/?name=Juan+Dela+Cruz')) {
      console.log('Fixing agent avatar');
      if (currentAgent.avatarUrl) {
        agentAvatar.src = currentAgent.avatarUrl;
      } else {
        const name = encodeURIComponent(currentAgent.agentName || 'User');
        agentAvatar.src = `https://ui-avatars.com/api/?name=${name}&background=random`;
      }
    }
  }
}

// Add this to the document ready function
document.addEventListener('DOMContentLoaded', function() {
  // Check if user is already logged in
  const savedAgent = localStorage.getItem('currentAgent');
  if (savedAgent) {
    try {
      currentAgent = JSON.parse(savedAgent);
      console.log('Restored logged in agent from localStorage:', currentAgent);
      showDashboard();
      
      // Add a delay to ensure the DOM is fully loaded
      setTimeout(checkAndFixSidebarDisplay, 500);
    } catch (e) {
      console.error('Error parsing saved agent:', e);
      localStorage.removeItem('currentAgent');
    }
  }
  
  // Add event listener for login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
  
  // Add event listener for logout button
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', handleLogout);
  }
  
  // Other initialization code...
});

// Update the handleLogin function to ensure proper display after login
function handleLogin(event) {
  event.preventDefault();
  const agentName = document.getElementById('agentName').value;
  const password = document.getElementById('password').value;
  const loginError = document.getElementById('loginError');
  
  if (!agentName || !password) {
    loginError.textContent = 'Please enter both agent name and password.';
    loginError.style.display = 'block';
    return;
  }

  console.log('Attempting login for agent:', agentName);
  loginError.style.display = 'none';

  const callbackName = 'handleLoginResponse';
  window[callbackName] = function(response) {
    console.log('Login Response:', response);
    if (!response.error) {
      currentAgent = response;
      localStorage.setItem('currentAgent', JSON.stringify(currentAgent));
      showDashboard();
      initSheets(); // Ensure sheets are created on successful login
      
      // Add a delay to ensure the DOM is fully updated
      setTimeout(checkAndFixSidebarDisplay, 500);
    } else {
      loginError.textContent = response.error;
      loginError.style.display = 'block';
    }
  };

  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=login&agent=${encodeURIComponent(agentName)}&password=${encodeURIComponent(password)}`;
  document.head.appendChild(script);
}

// Add a button to the personal details form to manually refresh
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener for the personal form submission
  const personalForm = document.getElementById('personalForm');
  if (personalForm) {
    personalForm.addEventListener('submit', function(event) {
      event.preventDefault();
      saveFormData('personalForm');
    });
    
    // Add a manual refresh button if it doesn't exist
    const personalDetailsForm = document.getElementById('personal-details-form');
    if (personalDetailsForm && !document.getElementById('manualRefreshBtn')) {
      const refreshButton = document.createElement('button');
      refreshButton.id = 'manualRefreshBtn';
      refreshButton.className = 'btn btn-secondary mb-4';
      refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Manual Refresh';
      refreshButton.onclick = function() {
        refreshPersonalDetails();
        return false;
      };
      
      // Insert after the page description
      const pageDescription = personalDetailsForm.querySelector('.page-description');
      if (pageDescription && pageDescription.parentNode) {
        pageDescription.parentNode.insertBefore(refreshButton, pageDescription.nextSibling);
      } else {
        // If no page description, insert at the beginning of the form container
        const formContainer = personalDetailsForm.querySelector('.form-container');
        if (formContainer) {
          formContainer.insertBefore(refreshButton, formContainer.firstChild.nextSibling);
        }
      }
    }
  }
  
  // Check if user is already logged in
  const savedAgent = localStorage.getItem('currentAgent');
  if (savedAgent) {
    try {
      currentAgent = JSON.parse(savedAgent);
      console.log('Restored logged in agent from localStorage:', currentAgent);
      showDashboard();
      
      // Add a delay to ensure the DOM is fully loaded
      setTimeout(checkAndFixSidebarDisplay, 500);
    } catch (e) {
      console.error('Error parsing saved agent:', e);
      localStorage.removeItem('currentAgent');
    }
  }
  
  // Add event listener for login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }
});

// Update the navigateTo function to load personal details
function navigateTo(pageId) {
  // First, check if the page exists
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.error(`Error: Page with ID "${pageId}" not found`);
    showToast(`Error: Page not found`, 'error');
    return; // Exit the function if the page doesn't exist
  }

  // Hide all pages and show the target page
  const pages = document.querySelectorAll('.page-content');
  pages.forEach(page => page.classList.add('hidden'));
  targetPage.classList.remove('hidden');

  // Update sidebar active link
  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  sidebarLinks.forEach(link => link.classList.remove('active'));
  
  // Map dashboardPageContent to dashboard for sidebar link selection
  const sidebarPageId = pageId === 'dashboardPageContent' ? 'dashboard' : pageId;
  
  // Add null check before accessing classList
  const activeLink = document.querySelector(`.sidebar-menu a[data-page="${sidebarPageId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  } else {
    console.warn(`No sidebar link found for page: ${pageId} (looking for ${sidebarPageId})`);
  }

  currentPage = pageId; // Update current page global variable
  console.log(`Navigated to: ${pageId}`);

  // Load data specific to the form - force reload from server
  const formId = pageId.replace('-form', '');
  if (formSheetMap[formId]) {
    console.log(`Loading data for ${formId} after navigation`);
    loadFormData(formId, true); // true = skip cache
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
  
  // Hide sidebar on mobile after navigation
  if (window.innerWidth <= 768) {
    document.getElementById('sidebar').classList.add('hidden');
    document.getElementById('mainContent').classList.add('full-width');
  }
}

// Add a function to manually refresh personal details
function refreshPersonalDetails() {
  console.log('Manually refreshing personal details');
  showToast('Refreshing personal details...', 'info');
  loadPersonalDetails();
}

// Make sure the personalForm has a hidden record_id field
document.addEventListener('DOMContentLoaded', function() {
  const personalForm = document.getElementById('personalForm');
  if (personalForm) {
    let recordIdField = personalForm.querySelector('input[name="record_id"]');
    if (!recordIdField) {
      recordIdField = document.createElement('input');
      recordIdField.type = 'hidden';
      recordIdField.name = 'record_id';
      recordIdField.id = 'personalRecordId';
      personalForm.appendChild(recordIdField);
    }
  }
});

// Update saveFormData to handle personal form specially
function saveFormData(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    showToast('Login required to save data.', 'error');
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

  // Convert FormData to a regular object
  const fields = {};
  for (let [key, value] of formData.entries()) {
    if (key === 'amount' && formId === 'expensesForm') {
      fields[key] = parseCurrency(value); // Parse currency for expenses
    } else {
      fields[key] = value;
    }
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

  const payload = {
    action: 'saveData', // This action is handled by doPost in Code.gs
    sheetName: sheetName,
    record_id: recordId,
    fields: fields
  };

  console.log('Saving data with payload:', payload);

  fetch(`https://script.google.com/macros/s/${scriptId}/exec`, {
    method: 'POST',
    mode: 'no-cors',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify(payload)
  })
  .then(response => {
    console.log('Form data sent (no-cors response):', response);
    showToast('Data saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    // For single-entry forms, reload the data to ensure UI is updated
    if (!['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
        loadFormData(formId);
    }
  })
  .catch(error => {
    console.error('Error saving form data:', error);
    showToast('Error saving data. Please try again.', 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
  });
}

function loadPersonalDetails() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('No current agent found');
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
  
  // Create a unique callback name to avoid conflicts
  const callbackName = 'handleGetPersonalDetailsResponse_' + new Date().getTime();
  window[callbackName] = function(response) {
    console.log('Personal Details Response:', response);
    
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
      
      // If no data found, pre-fill the agent name field
      const nameField = document.getElementById('name');
      if (nameField && (!nameField.value || nameField.value.trim() === '')) {
        nameField.value = currentAgent.agentName;
      }
      
      // Make sure record_id is set even if no data was found
      const recordIdInput = document.getElementById('personalRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_personalForm`;
      }
    }
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime(); // Add timestamp to prevent caching
  const url = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getAgentPersonalDetails&agent=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
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

// Add a button to the personal details form to manually refresh
document.addEventListener('DOMContentLoaded', function() {
  // Add event listener for the personal form submission
  const personalForm = document.getElementById('personalForm');
  if (personalForm) {
    personalForm.addEventListener('submit', function(event) {
      event.preventDefault();
      saveFormData('personalForm');
    });
    
    // Add a manual refresh button if it doesn't exist
    const personalDetailsForm = document.getElementById('personal-details-form');
    if (personalDetailsForm && !document.getElementById('manualRefreshBtn')) {
      const refreshButton = document.createElement('button');
      refreshButton.id = 'manualRefreshBtn';
      refreshButton.className = 'btn btn-secondary mb-4';
      refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-1"></i> Manual Refresh';
      refreshButton.onclick = function() {
        refreshPersonalDetails();
        return false;
      };
      
      // Insert at the beginning of the form
      const formContainer = personalDetailsForm.querySelector('.form-container');
      if (formContainer) {
        formContainer.insertBefore(refreshButton, formContainer.firstChild);
      }
    }
  }
});

// Update the refreshPersonalDetails function to handle both admin and regular users
function refreshPersonalDetails() {
  if (currentAgent && currentAgent.role === 'admin') {
    loadAllPersonalDetails();
    showToast('Refreshing all personal details...', 'info');
  } else {
    loadPersonalDetails();
    showToast('Refreshing your personal details...', 'info');
  }
}

// Debug function to help troubleshoot
function debugPersonalDetails() {
  console.log('=== DEBUG PERSONAL DETAILS ===');
  console.log('Current Agent:', currentAgent);
  
  const personalForm = document.getElementById('personalForm');
  if (!personalForm) {
    console.error('Personal form not found in DOM');
    return;
  }
  
  console.log('Form elements:');
  Array.from(personalForm.elements).forEach(element => {
    if (element.name) {
      console.log(`${element.name}: ${element.value}`);
    }
  });
  
  // Try to load data directly
  console.log('Attempting to load personal details directly...');
  
  const callbackName = 'debugPersonalDetailsCallback';
  window[callbackName] = function(response) {
    console.log('Debug Personal Details Response:', response);
  };
  
  const script = document.createElement('script');
  const timestamp = new Date().getTime();
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getAgentPersonalDetails&agent=${encodeURIComponent(currentAgent.agentName)}&t=${timestamp}`;
  document.head.appendChild(script);
  
  console.log('Debug request sent');
}

// Add a debug button to the personal details form
document.addEventListener('DOMContentLoaded', function() {
  const personalDetailsForm = document.getElementById('personal-details-form');
  if (personalDetailsForm && !document.getElementById('debugBtn')) {
    const debugButton = document.createElement('button');
    debugButton.id = 'debugBtn';
    debugButton.className = 'btn btn-secondary mb-4 ml-2';
    debugButton.innerHTML = '<i class="fas fa-bug mr-1"></i> Debug';
    debugButton.onclick = function() {
      debugPersonalDetails();
      return false;
    };
    
    // Find the refresh button and add this after it
    const refreshButton = personalDetailsForm.querySelector('button[id="manualRefreshBtn"]');
    if (refreshButton && refreshButton.parentNode) {
      refreshButton.parentNode.insertBefore(debugButton, refreshButton.nextSibling);
    }
  }
});

// Add this to document ready or initialization
document.addEventListener('DOMContentLoaded', function() {
  // Add the table to the personal details page for admin users
  const personalDetailsPage = document.getElementById('personal-details-form');
  if (personalDetailsPage && !document.getElementById('allPersonalDetailsTable')) {
    // Create the admin table container
    const adminTableContainer = document.createElement('div');
    adminTableContainer.className = 'admin-only form-container mt-6';
    adminTableContainer.innerHTML = `
      <h3 class="text-xl font-semibold mb-4">All Personal Details (Admin View)</h3>
      <div class="data-table-container">
        <table id="allPersonalDetailsTable" class="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Agent ID</th>
              <th>State</th>
              <th>NPN</th>
              <th>Number</th>
              <th>Email</th>
              <th>Children</th>
              <th>Exam Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="9" class="text-center p-4">Loading personal details...</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
    
    // Add the table to the page
    personalDetailsPage.appendChild(adminTableContainer);
    
    // Add refresh button to personal details page
    const refreshButton = document.createElement('button');
    refreshButton.className = 'btn btn-secondary mb-4';
    refreshButton.innerHTML = '<i class="fas fa-sync-alt mr-2"></i> Refresh Data';
    refreshButton.onclick = refreshPersonalDetails;
    
    // Insert after the page description
    const pageDescription = personalDetailsPage.querySelector('.page-description');
    if (pageDescription && pageDescription.parentNode) {
      pageDescription.parentNode.insertBefore(refreshButton, pageDescription.nextSibling);
    }
  }
});
