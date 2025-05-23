// Global variables
let currentPage = 'dashboard'; // Default to dashboard
let currentAgent = null; // Stores logged-in agent info
const AUTO_SAVE_DELAY = 300; // Reduced from 1000ms to 300ms
const AUTO_SUBMIT_DELAY = 5000;
let autoSaveTimeout = null;
let autoSubmitTimeout = null;
let autoSaveEnabled = true; // New variable to control auto-save feature

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
const scriptId = 'AKfycbze-r0dn1wjfCFqhowVThQwy9PtkQFcuITtV3nDUUNM6XgzkF7dKkd-imknIUAngkNsmA'; // Replace with your actual script ID

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
  // Remove showLoading() call
  const callbackName = 'handleInitSheetsResponse';
  window[callbackName] = function(response) {
    console.log('Init Sheets Response:', response);
    if (response.status === 'success') {
      showToast('System initialized successfully!', 'success');
    } else {
      showToast('Error initializing system: ' + response.message, 'error');
    }
    // Remove hideLoading() call
  };

  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&init=true`;
  document.head.appendChild(script);
}

// Handle Page Navigation
function navigateTo(pageId) {
  const pages = document.querySelectorAll('.page-content');
  pages.forEach(page => page.classList.add('hidden'));
  document.getElementById(pageId).classList.remove('hidden');

  const sidebarLinks = document.querySelectorAll('.sidebar-menu a');
  sidebarLinks.forEach(link => link.classList.remove('active'));
  
  // Add null check before accessing classList
  const activeLink = document.querySelector(`.sidebar-menu a[data-page="${pageId}"]`);
  if (activeLink) {
    activeLink.classList.add('active');
  }

  currentPage = pageId; // Update current page global variable
  console.log(`Mapped to: ${pageId}`);

  // Load data specific to the form
  if (formSheetMap[pageId.replace('-form', '')]) {
    loadFormData(pageId.replace('-form', ''));
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

  // Remove showLoading() call here
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

  // Generate a new record_id if it's a new entry (not an update)
  if (!recordId) {
    recordId = generateRecordId(currentAgent.agentName, formId);
    if (recordIdInput) {
      recordIdInput.value = recordId; // Update the form's hidden input
    }
  }

  const fields = {};
  for (let [key, value] of formData.entries()) {
    // Exclude the record_id itself from the fields object as it's handled separately
    if (key !== 'record_id' && key !== 'agentName') { // Exclude agentName from form fields
      if (key === 'amount' && formId === 'expensesForm') {
        fields[key] = parseCurrency(value); // Parse currency for expenses
      } else {
        fields[key] = value;
      }
    }
  }

  // Add agent name to the data
  fields['agent'] = currentAgent.agentName; // Ensure agent name is always saved

  const payload = {
    action: 'saveData', // This action is handled by doPost in Code.gs
    sheetName: sheetName,
    record_id: recordId,
    fields: fields
  };

  fetch(`https://script.google.com/macros/s/${scriptId}/exec`, {
    method: 'POST',
    mode: 'no-cors', // Required for simple CORS requests without preflight
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: JSON.stringify(payload) // Send payload as JSON string
  })
  .then(response => {
    // For no-cors, response.ok is always true, and response.json() is not accessible.
    // We rely on the Apps Script for logging and the next fetch for verification.
    console.log('Form data sent (no-cors response):', response);
    // You might need a separate GET request to verify success for no-cors,
    // or rely on Apps Script's logging for debugging.
    showToast('Data saved successfully!', 'success');
    updateSaveStatus('Saved!', saveStatusElementId);
    // Remove hideLoading() call here
    // For single-entry forms, reload the data to ensure UI is updated
    if (!['dreamsForm', 'expensesForm', 'partnersForm', 'clientsForm'].includes(formId)) {
        loadFormData(formId);
    }
  })
  .catch(error => {
    console.error('Error saving data:', error);
    showToast('Error saving data: ' + error.message, 'error');
    updateSaveStatus('Error saving!', saveStatusElementId);
    // Remove hideLoading() call here
  });
}

// Load form data from Google Sheet
function loadFormData(formId, skipCache = false) {
  if (!currentAgent || !currentAgent.agentName) {
    // Don't show toast, just return, as this might be called before login
    return;
  }
  // Remove showLoading() call here
  const sheetName = formSheetMap[formId];
  if (!sheetName) {
    showToast('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  const callbackName = `handleGetFormDataResponse_${formId.replace(/-/g, '_')}`;
  window[callbackName] = function(response) {
    console.log(`Get Form Data Response for ${formId}:`, response);
    if (response.status === 'success' && response.formData) {
      if (response.formData.entries) { // Multi-entry form (e.g., Dreams List, Expenses)
        renderMultiEntryTable(formId, response.formData.entries);
      } else { // Single-entry form
        populateForm(formId, response.formData);
      }
    } else {
      showToast('No existing data found or error loading: ' + response.message, 'info');
      // For single-entry forms, ensure inputs are cleared for new entry
      if (!response.formData || !response.formData.entries) {
        clearForm(formId);
      }
    }
    // Remove hideLoading() call here
  };
  
  const sessionId = currentAgent.agentName; // Use agent name as session ID
  const script = document.createElement('script');
  script.src = `https://script.google.com/macros/s/${scriptId}/exec?callback=${callbackName}&action=getFormData&sheetName=${encodeURIComponent(sheetName)}&sessionId=${encodeURIComponent(sessionId)}&skipCache=${skipCache}`;
  document.head.appendChild(script);
}

function populateForm(formId, data) {
  const form = document.getElementById(formId);
  if (!form) return;

  for (const key in data) {
    const input = form.querySelector(`[name="${key}"]`);
    if (input) {
      if (input.type === 'date') {
        // Format date string to YYYY-MM-DD for date input
        input.value = data[key] ? new Date(data[key]).toISOString().split('T')[0] : '';
      } else if (input.type === 'checkbox') {
        input.checked = (data[key] === 'true' || data[key] === 'Yes');
      } else if (input.tagName === 'SELECT') {
        input.value = data[key]; // Directly set value for select
      } else if (key === 'amount' && formId === 'expensesForm') {
        input.value = formatCurrency(data[key]); // Format currency for display
      } else {
        input.value = data[key];
      }
    }
  }

  // Set the hidden record_id field
  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    recordIdInput.value = data.record_id || '';
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
  const tableBody = document.querySelector(`#${formId} .data-table tbody`);
  if (!tableBody) return;

  tableBody.innerHTML = ''; // Clear existing rows

  entries.forEach((entry, index) => {
    const row = tableBody.insertRow();
    row.dataset.recordId = entry.record_id; // Store record_id on the row
    row.dataset.index = index; // Store index for editing

    if (formId === 'dreamsForm') {
      row.insertCell().textContent = entry.time_frame || '';
      row.insertCell().textContent = entry.dream || '';
      row.insertCell().textContent = entry.why || '';
    } else if (formId === 'expensesForm') {
      row.insertCell().textContent = entry.item || '';
      row.insertCell().textContent = formatCurrency(entry.amount);
      row.insertCell().textContent = entry.category || '';
      row.insertCell().textContent = entry.date ? new Date(entry.date).toLocaleDateString('en-US') : '';
      row.insertCell().textContent = entry.description || '';
    } else if (formId === 'partnersForm') {
      row.insertCell().textContent = entry.name || '';
      row.insertCell().textContent = entry.contact || '';
      row.insertCell().textContent = entry.email || '';
      row.insertCell().textContent = entry.status || '';
      row.insertCell().textContent = entry.notes || '';
    } else if (formId === 'clientsForm') { // Field Trainings
      row.insertCell().textContent = entry.client_name || '';
      row.insertCell().textContent = entry.date ? new Date(entry.date).toLocaleDateString('en-US') : '';
      row.insertCell().textContent = entry.type_of_training || '';
      row.insertCell().textContent = entry.outcome || '';
      row.insertCell().textContent = entry.notes || '';
    }

    const actionsCell = row.insertCell();
    actionsCell.className = 'table-actions';
    actionsCell.innerHTML = `
      <button class="edit-btn" data-form-id="${formId}" data-index="${index}"><i class="fas fa-edit"></i></button>
      <button class="delete-btn" data-form-id="${formId}" data-index="${index}"><i class="fas fa-trash-alt"></i></button>
    `;
  });

  // Attach event listeners for edit and delete buttons after rendering
  attachMultiEntryTableListeners(formId);
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

  // Remove showLoading() call here
  showToast('Saving all entries...', 'info');
  
  const sheetName = formSheetMap[formId];
  const saveStatusElementId = `${formId}SaveStatus`;
  const entriesToSave = JSON.parse(localStorage.getItem(`${formId}_entries`)) || [];

  if (!sheetName) {
    showToast('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  const payload = {
    action: 'bulkUpdateEntries', // New action for bulk updates
    sheetName: sheetName,
    agent: currentAgent.agentName,
    formId: formId, // Pass formId for server-side mapping to sheetName
    entries: entriesToSave // Array of all entries for the current agent
  };

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
    // Remove hideLoading() call here
    // After successful save, reload from server to ensure local storage is in sync
    loadFormData(formId, true); // Force skip cache
  })
  .catch(error => {
    console.error('Error saving bulk data:', error);
    showToast('Error saving all entries: ' + error.message, 'error');
    updateSaveStatus('Error saving all!', saveStatusElementId);
    // Remove hideLoading() call here
  });
}


// --- Login / Logout Functions ---

function handleLogin(event) {
  event.preventDefault();
  // Remove showLoading() call
  const agentName = document.getElementById('agentName').value;
  const password = document.getElementById('password').value;
  const loginError = document.getElementById('loginError');

  const callbackName = 'handleLoginResponse';
  window[callbackName] = function(response) {
    console.log('Login Response:', response);
    if (!response.error) {
      currentAgent = response;
      localStorage.setItem('currentAgent', JSON.stringify(currentAgent));
      showDashboard();
      initSheets(); // Ensure sheets are created on successful login
    } else {
      loginError.textContent = response.error;
      loginError.style.display = 'block';
    }
    // Remove hideLoading() call
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
  document.getElementById('agentNameDisplay').textContent = currentAgent.agentName;
  document.getElementById('headerAgentName').textContent = currentAgent.agentName;
  document.getElementById('agentRoleDisplay').textContent = currentAgent.role;
  if (currentAgent.avatarUrl) {
    document.getElementById('agentAvatar').src = currentAgent.avatarUrl;
  } else {
    document.getElementById('agentAvatar').src = 'https://source.unsplash.com/40x40/?face,portrait';

  }

  navigateTo('dashboardPageContent'); // Show dashboard content by default
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
      navigateTo(this.dataset.page);
    });
  });

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
