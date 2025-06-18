// Enhanced Data Entry System - Bug fixes and UI/UX improvements
// Global variables
let currentPage = 'dashboard';
let currentAgent = null;
const AUTO_SAVE_DELAY = 2000;
let autoSaveTimeout = null;
let autoSaveEnabled = true;
let isLoading = false; // Loading state tracker

// !!! IMPORTANT: REPLACE 'YOUR_DEPLOYMENT_ID_HERE' with your actual Google Apps Script Web App Deployment ID
const scriptId = 'AKfycbxD0wWtSaY2Dq4Ugz5s54nc155RLc6Tf47EkpBYSdyMmhZdZZeM-ta032dKVNLNl6uphg'; // Replace with your actual script ID

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

// Initialize data arrays for multi-entry forms
let dreamsData = [];

// Enhanced toast notification system
class ToastManager {
  constructor() {
    this.toastContainer = null;
    this.init();
  }

  init() {
    // Create toast container if it doesn't exist
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'fixed top-4 right-4 z-50 space-y-2';
      document.body.appendChild(container);
    }
    this.toastContainer = container;
  }

  show(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    const id = 'toast-' + Date.now();
    toast.id = id;
    
    const typeClasses = {
      success: 'bg-green-500 text-white',
      error: 'bg-red-500 text-white',
      warning: 'bg-yellow-500 text-black',
      info: 'bg-blue-500 text-white'
    };

    const icons = {
      success: '✓',
      error: '✗',
      warning: '⚠',
      info: 'ℹ'
    };

    toast.className = `${typeClasses[type]} px-4 py-3 rounded-lg shadow-lg flex items-center space-x-2 min-w-0 max-w-sm transform transition-all duration-300 translate-x-full opacity-0`;
    
    toast.innerHTML = `
      <span class="text-xl">${icons[type]}</span>
      <span class="flex-1 text-sm font-medium">${message}</span>
      <button class="text-white hover:text-gray-200 ml-2" onclick="toastManager.remove('${id}')">
        <svg class="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
          <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"></path>
        </svg>
      </button>
    `;

    this.toastContainer.appendChild(toast);

    // Animate in
    setTimeout(() => {
      toast.classList.remove('translate-x-full', 'opacity-0');
    }, 100);

    // Auto remove
    if (duration > 0) {
      setTimeout(() => {
        this.remove(id);
      }, duration);
    }

    return id;
  }

  remove(id) {
    const toast = document.getElementById(id);
    if (toast) {
      toast.classList.add('translate-x-full', 'opacity-0');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }
  }
}

// Initialize toast manager
const toastManager = new ToastManager();

// API helper functions
async function makeApiCall(url) {
  return new Promise((resolve, reject) => {
    const callbackName = 'apiCallback_' + new Date().getTime();
    
    // Set up the callback
    window[callbackName] = function(response) {
      // Clean up
      delete window[callbackName];
      const script = document.querySelector(`script[src*="${callbackName}"]`);
      if (script) {
        script.remove();
      }
      
      resolve(response);
    };
    
    // Create and append script
    const script = document.createElement('script');
    const separator = url.includes('?') ? '&' : '?';
    script.src = `${url}${separator}callback=${callbackName}&t=${new Date().getTime()}`;
    
    script.onerror = function() {
      // Clean up on error
      delete window[callbackName];
      script.remove();
      reject(new Error('Network error: Failed to load script'));
    };
    
    // Set timeout for API calls
    setTimeout(() => {
      if (window[callbackName]) {
        delete window[callbackName];
        script.remove();
        reject(new Error('Request timeout'));
      }
    }, 30000); // 30 second timeout
    
    document.head.appendChild(script);
  });
}

function handleApiError(error, operation) {
  console.error(`Error during ${operation}:`, error);
  let message = 'An error occurred';
  
  if (error.message) {
    if (error.message.includes('Network error')) {
      message = 'Network connection error. Please check your internet connection.';
    } else if (error.message.includes('timeout')) {
      message = 'Request timed out. Please try again.';
    } else {
      message = error.message;
    }
  }
  
  toastManager.show(message, 'error');
}

// Utility functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('en-PH', {
    style: 'currency',
    currency: 'PHP'
  }).format(amount || 0);
}

// Enhanced loading state management
class LoadingManager {
  constructor() {
    this.activeOperations = new Set();
    this.loadingOverlay = null;
    this.init();
  }

  init() {
    // Create loading overlay
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.className = 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center hidden';
    overlay.innerHTML = `
      <div class="bg-white rounded-lg p-6 flex items-center space-x-3">
        <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span class="text-gray-700 font-medium">Loading...</span>
      </div>
    `;
    document.body.appendChild(overlay);
    this.loadingOverlay = overlay;
  }

  show(operationId = 'default') {
    this.activeOperations.add(operationId);
    this.loadingOverlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  hide(operationId = 'default') {
    this.activeOperations.delete(operationId);
    if (this.activeOperations.size === 0) {
      this.loadingOverlay.classList.add('hidden');
      document.body.style.overflow = '';
    }
  }
}

const loadingManager = new LoadingManager();

// Enhanced role-based access control
function setupRoleBasedAccess() {
  if (!currentAgent || !currentAgent.role) {
    console.error('Cannot setup role-based access: No current agent or role information');
    return;
  }
  
  console.log('Setting up role-based access for role:', currentAgent.role);
  const isAdmin = currentAgent.role.toLowerCase() === 'admin';
  
  // Show/hide admin-only elements
  document.querySelectorAll('.admin-only').forEach(element => {
    element.style.display = isAdmin ? 'block' : 'none';
    element.classList.toggle('hidden', !isAdmin);
  });
  
  // Show/hide sidebar menu items based on role
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    const page = link.getAttribute('data-page');
    link.style.display = '';
    
    if (!isAdmin && page === 'user-management') {
      link.style.display = 'none';
    }
  });
}

// Enhanced auto-save functionality
function toggleAutoSave() {
  autoSaveEnabled = !autoSaveEnabled;
  const message = autoSaveEnabled ? 'Auto-save enabled' : 'Auto-save disabled';
  toastManager.show(message, 'info');
  
  // Update UI buttons
  document.querySelectorAll('.auto-save-toggle').forEach(btn => {
    btn.textContent = autoSaveEnabled ? 'Disable Auto-Save' : 'Enable Auto-Save';
    btn.classList.toggle('btn-secondary', autoSaveEnabled);
    btn.classList.toggle('btn-warning', !autoSaveEnabled);
  });
}

// Enhanced form validation
function validateForm(formId) {
  const form = document.getElementById(formId);
  if (!form) return { isValid: false, errors: ['Form not found'] };

  const errors = [];
  const requiredFields = form.querySelectorAll('[required]');

  requiredFields.forEach(field => {
    if (!field.value.trim()) {
      errors.push(`${field.labels[0]?.textContent || field.name} is required`);
      field.classList.add('border-red-500');
    } else {
      field.classList.remove('border-red-500');
    }
  });

  // Email validation
  const emailFields = form.querySelectorAll('input[type="email"]');
  emailFields.forEach(field => {
    if (field.value && !isValidEmail(field.value)) {
      errors.push('Please enter a valid email address');
      field.classList.add('border-red-500');
    }
  });

  return {
    isValid: errors.length === 0,
    errors
  };
}

function isValidEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

// Note: makeApiCall function is already declared at the top of the file

// Note: scriptId and formSheetMap are already declared at the top of the file

// Enhanced UI helper functions
function updateSaveStatus(message, statusElementId, type = 'info') {
  const statusEl = document.getElementById(statusElementId);
  if (!statusEl) return;
  
  const icons = {
    success: '<i class="fas fa-check text-green-500 mr-1"></i>',
    error: '<i class="fas fa-times text-red-500 mr-1"></i>',
    loading: '<i class="fas fa-spinner fa-spin text-blue-500 mr-1"></i>',
    info: '<i class="fas fa-info-circle text-blue-500 mr-1"></i>'
  };

  statusEl.innerHTML = (icons[type] || '') + message;
  statusEl.style.opacity = '1';
  
  if (autoSaveTimeout) clearTimeout(autoSaveTimeout);
  
  if (type !== 'loading') {
    autoSaveTimeout = setTimeout(() => {
      statusEl.style.opacity = '0';
    }, 3000);
  }
}

// Enhanced navigation with loading states
function navigateTo(pageId) {
  if (isLoading) {
    toastManager.show('Please wait for current operation to complete', 'warning');
    return;
  }

  console.log(`Navigating to: ${pageId}`);
  
  // Handle special cases
  if (pageId === 'dashboard') {
    pageId = 'dashboardPageContent';
  }
  
  // Fix double form suffix
  if (pageId.endsWith('-form-form')) {
    pageId = pageId.replace('-form-form', '-form');
  }
  
  // Page ID mapping
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
  
  if (pageIdMap[pageId]) {
    pageId = pageIdMap[pageId];
  }
  
  const targetPage = document.getElementById(pageId);
  if (!targetPage) {
    console.error(`Page with ID "${pageId}" not found`);
    toastManager.show(`Error: Page not found (${pageId})`, 'error');
    return;
  }

  // CLEAN NAVIGATION: Use the proven working method with clean styling
  console.log(`🎯 Clean navigation to: ${pageId}`);
  
  // Apply clean styling that works
  targetPage.style.cssText = `
    display: block !important;
    opacity: 1 !important;
    visibility: visible !important;
    position: relative !important;
    margin: 0 !important;
    padding: 0 !important;
    background: transparent !important;
    border: none !important;
    z-index: 1 !important;
    width: 100% !important;
    min-height: auto !important;
  `;
  
  // Force parent containers to be visible
  let parent = targetPage.parentElement;
  while (parent) {
    parent.style.overflow = 'visible';
    parent.style.height = 'auto';
    parent.style.display = 'block';
    parent = parent.parentElement;
    if (parent === document.body) break;
  }
  
  console.log(`✅ Clean styling applied to: ${pageId}`);
  
  // Hide all OTHER pages (but keep target visible)
  document.querySelectorAll('.page-content').forEach(page => {
    if (page.id !== pageId) {  // Don't hide the target page
      page.style.display = 'none';
    }
  });
  
  // Scroll to the form smoothly
  targetPage.scrollIntoView({ behavior: 'smooth' });
  
  console.log(`✅ Clean navigation complete: ${pageId} visible with clean styling`);

  // Load data for specific forms
  loadingManager.show('navigation');
  
  setTimeout(() => {
    switch (pageId) {
      case 'dashboardPageContent':
        loadDashboardStats();
        break;
      case 'system-progressions-form':
        setupProgressionsForm();
        break;
      case 'licensing-checklist-form':
        setupLicensingForm();
        break;
      case 'career-progression-form':
        setupCareerProgressionForm();
        break;
      case 'personal-details-form':
        loadPersonalDetails();
        if (currentAgent && currentAgent.role === 'admin') {
          setTimeout(() => loadAllPersonalDetails(), 200);
        }
        break;
      case 'dreams-list-form':
        loadDreamsData();
        break;
      case 'user-management-form':
        if (currentAgent && currentAgent.role === 'admin') {
          loadUsers();
          populateUserDropdown();
          
          // Scroll to top and fix positioning
          window.scrollTo(0, 0);
          setTimeout(() => {
            const userMgmtForm = document.getElementById('user-management-form');
            if (userMgmtForm) {
              userMgmtForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 200);
        }
        break;
    }
    
    loadingManager.hide('navigation');
  }, 100);

  // Update sidebar active state
  updateSidebarActiveState(pageId);
  currentPage = pageId;
}

function updateSidebarActiveState(pageId) {
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.classList.remove('active');
  });
  
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
    }
  }
}

// Enhanced login function with better error handling
async function login() {
  console.log('🔐 Login function called');
  
  const agentNameInput = document.getElementById('agentName');
  const passwordInput = document.getElementById('password');
  const loginError = document.getElementById('loginError');
  
  const agentName = agentNameInput.value.trim();
  const password = passwordInput.value;
  
  console.log('🔐 Login attempt for agent:', agentName);
  
  // Clear previous errors
  if (loginError) {
    loginError.style.display = 'none';
  }
  agentNameInput.classList.remove('border-red-500');
  passwordInput.classList.remove('border-red-500');
  
  // Validation
  if (!agentName || !password) {
    const message = 'Agent name and password are required.';
    if (loginError) {
      loginError.textContent = message;
      loginError.style.display = 'block';
    }
    
    if (!agentName) agentNameInput.classList.add('border-red-500');
    if (!password) passwordInput.classList.add('border-red-500');
    
    toastManager.show(message, 'error');
    return false;
  }
  
  loadingManager.show('login');
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=login&agent=${encodeURIComponent(agentName)}&password=${encodeURIComponent(password)}`;
    const response = await makeApiCall(url);
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    // Successful login
    currentAgent = {
      agentName: response.agentName || agentName, // Fallback to input name
      role: response.role || (agentName.toLowerCase() === 'admin' ? 'admin' : 'user'), // Fix admin role detection
      avatarUrl: response.avatarUrl || ''
    };
    
    // Additional admin role check for safety
    if (agentName.toLowerCase() === 'admin' || response.role === 'admin') {
      currentAgent.role = 'admin';
    }
    
    console.log('🔐 Login successful! Current agent set to:', currentAgent);
    sessionStorage.setItem('currentAgent', JSON.stringify(currentAgent));
    
    // Update UI
    const loginPage = document.getElementById('loginPage');
    const dashboardPage = document.getElementById('dashboardPage');
    
    if (loginPage) loginPage.style.display = 'none';
    if (dashboardPage) dashboardPage.style.display = 'flex';
    
    setupRoleBasedAccess();
    navigateTo('dashboardPageContent');
    
    // Update header and sidebar
    updateUserInterface();
    
    toastManager.show(`Welcome, ${currentAgent.agentName}! (${currentAgent.role})`, 'success');
    
  } catch (error) {
    console.error('Login error:', error);
    const message = error.message || 'Network error. Please try again.';
    
    if (loginError) {
      loginError.textContent = message;
      loginError.style.display = 'block';
    }
    
    toastManager.show(message, 'error');
  } finally {
    loadingManager.hide('login');
  }
  
  return false;
}

function updateUserInterface() {
  if (!currentAgent) return;
  
  // Update header
  const headerAgentName = document.getElementById('headerAgentName');
  if (headerAgentName) headerAgentName.textContent = currentAgent.agentName;
  
  // Update sidebar
  const agentNameDisplay = document.getElementById('agentNameDisplay');
  const agentRoleDisplay = document.getElementById('agentRoleDisplay');
  const agentAvatar = document.getElementById('agentAvatar');
  
  if (agentNameDisplay) agentNameDisplay.textContent = currentAgent.agentName;
  if (agentRoleDisplay) agentRoleDisplay.textContent = currentAgent.role;
  
  if (agentAvatar) {
    if (currentAgent.avatarUrl) {
      agentAvatar.src = currentAgent.avatarUrl;
    } else {
      agentAvatar.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(currentAgent.agentName)}&background=random`;
    }
  }
}

// Enhanced form saving with validation
async function saveFormData(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    toastManager.show('Login required to save data.', 'error');
    return;
  }

  // Validate form
  const validation = validateForm(formId);
  if (!validation.isValid) {
    toastManager.show('Please fix the following errors:\n' + validation.errors.join('\n'), 'error');
    return;
  }

  const form = document.getElementById(formId);
  const sheetName = formSheetMap[formId];
  const saveStatusElementId = `${formId}SaveStatus`;
  
  if (!sheetName) {
    toastManager.show('Error: Sheet not mapped for this form.', 'error');
    return;
  }

  updateSaveStatus('Saving...', saveStatusElementId, 'loading');
  loadingManager.show('save');
  
  try {
    const formData = new FormData(form);
    const recordIdInput = form.querySelector('input[name="record_id"]');
    let recordId = recordIdInput ? recordIdInput.value : '';

    if (!recordId) {
      recordId = `${currentAgent.agentName}_${formId}`;
      if (recordIdInput) recordIdInput.value = recordId;
    }

    const fields = {};
    for (let [key, value] of formData.entries()) {
      fields[key] = value;
    }

    // Handle checkboxes
    const checkboxes = form.querySelectorAll('input[type="checkbox"]');
    checkboxes.forEach(checkbox => {
      fields[checkbox.name] = checkbox.checked;
    });

    fields['agent'] = currentAgent.agentName;
    fields['agentName'] = currentAgent.agentName;

    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=saveData&sheetName=${encodeURIComponent(sheetName)}&record_id=${encodeURIComponent(recordId)}&data=${encodeURIComponent(JSON.stringify(fields))}`;
    
    const response = await makeApiCall(url);
    
    if (response.status === 'success') {
      updateSaveStatus('Saved successfully!', saveStatusElementId, 'success');
      toastManager.show('Data saved successfully!', 'success');
    } else {
      throw new Error(response.message || 'Unknown error');
    }

  } catch (error) {
    console.error('Save error:', error);
    updateSaveStatus('Error saving', saveStatusElementId, 'error');
    toastManager.show('Error saving data: ' + error.message, 'error');
  } finally {
    loadingManager.hide('save');
  }
}

// Enhanced auto-save with debouncing
function setupAutoSave(formId) {
  const form = document.getElementById(formId);
  if (!form) return;

  const inputs = form.querySelectorAll('input, textarea, select');
  
  inputs.forEach(input => {
    input.addEventListener('input', debounce(() => {
      if (autoSaveEnabled) {
        saveFormData(formId);
      }
    }, AUTO_SAVE_DELAY));
  });
}

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Enhanced error handling for API calls
function handleApiError(error, context = 'operation') {
  console.error(`Error in ${context}:`, error);
  
  let message = 'An unexpected error occurred.';
  
  if (error.message) {
    if (error.message.includes('Network')) {
      message = 'Network error. Please check your connection and try again.';
    } else if (error.message.includes('timeout')) {
      message = 'Request timed out. Please try again.';
    } else {
      message = error.message;
    }
  }
  
  toastManager.show(message, 'error');
}

// Initialize date and time display
function updateDateTime() {
  const now = new Date();
  const dateElement = document.getElementById('currentDate');
  const timeElement = document.getElementById('currentTime');
  
  if (dateElement) {
    dateElement.textContent = now.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
  
  if (timeElement) {
    timeElement.textContent = now.toLocaleTimeString('en-US', {
      hour12: true,
      hour: 'numeric',
      minute: '2-digit'
    });
  }
}

// Currency formatting helpers
function formatCurrency(value) {
  if (value === null || value === undefined || isNaN(value)) return '';
  return '₱' + parseFloat(value).toLocaleString('en-US', { 
    minimumFractionDigits: 2, 
    maximumFractionDigits: 2 
  });
}

function parseCurrency(value) {
  if (!value) return null;
  const num = parseFloat(value.replace(/₱|,/g, ''));
  return isNaN(num) ? null : num;
}

// Mobile responsiveness enhancements
function setupMobileHandlers() {
  const menuToggle = document.getElementById('menuToggle');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.getElementById('mainContent');
  
  if (menuToggle && sidebar) {
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('hidden');
      if (mainContent) {
        mainContent.classList.toggle('full-width');
      }
    });
  }
  
  // Close sidebar when clicking outside on mobile
  document.addEventListener('click', (e) => {
    if (window.innerWidth <= 768) {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.add('hidden');
        if (mainContent) {
          mainContent.classList.add('full-width');
        }
      }
    }
  });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
  console.log('Enhanced Data Entry System - Initializing...');
  
  // Update date/time immediately and then every minute
  updateDateTime();
  setInterval(updateDateTime, 60000);
  
  // Setup mobile handlers
  setupMobileHandlers();
  
  // Check for existing session
  const savedAgent = sessionStorage.getItem('currentAgent');
  if (savedAgent) {
    try {
      currentAgent = JSON.parse(savedAgent);
      
      // Fix admin role if needed
      if (currentAgent.agentName && currentAgent.agentName.toLowerCase() === 'admin') {
        currentAgent.role = 'admin';
        sessionStorage.setItem('currentAgent', JSON.stringify(currentAgent));
      }
      
      console.log('Restored session for:', currentAgent.agentName, 'Role:', currentAgent.role);
      
      const loginPage = document.getElementById('loginPage');
      const dashboardPage = document.getElementById('dashboardPage');
      
      if (loginPage) loginPage.style.display = 'none';
      if (dashboardPage) dashboardPage.style.display = 'flex';
      
      setupRoleBasedAccess();
      updateUserInterface();
      navigateTo('dashboardPageContent');
      
    } catch (e) {
      console.error('Error restoring session:', e);
      sessionStorage.removeItem('currentAgent');
    }
  }
  
  // Setup event listeners
  setupEventListeners();
  
  console.log('Enhanced Data Entry System - Ready!');
});

function setupEventListeners() {
  // Login form
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      login();
    });
  }
  
  // Sidebar navigation
  document.querySelectorAll('.sidebar-menu a').forEach(link => {
    link.addEventListener('click', function(e) {
      e.preventDefault();
      const pageId = this.getAttribute('data-page');
      console.log(`🔗 Sidebar clicked: ${pageId}`);
      
      if (pageId) {
        // Update active state
        document.querySelectorAll('.sidebar-menu a').forEach(a => a.classList.remove('active'));
        this.classList.add('active');
        
        // Navigate
        navigateTo(pageId);
      } else {
        console.error('❌ No data-page attribute found');
      }
    });
  });
  
  // Logout button
  const logoutButton = document.getElementById('logoutButton');
  if (logoutButton) {
    logoutButton.addEventListener('click', function(e) {
      e.preventDefault();
      logout();
    });
  }
  
  // Form submissions
  document.querySelectorAll('form').forEach(form => {
    if (form.id !== 'loginForm') {
      // Special handling for change password form
      if (form.id === 'changePasswordForm') {
        form.addEventListener('submit', async function(e) {
          e.preventDefault();
          const formData = new FormData(this);
          const targetAgentName = formData.get('targetAgentName');
          const newPassword = formData.get('newPassword');
          const confirmPassword = formData.get('confirmPassword');
          
          if (!targetAgentName) {
            toastManager.show('Please select a user', 'error');
            return;
          }
          
          if (newPassword !== confirmPassword) {
            toastManager.show('Passwords do not match', 'error');
            return;
          }
          
          if (newPassword.length < 4) {
            toastManager.show('Password must be at least 4 characters', 'error');
            return;
          }
          
          const success = await changeUserPassword(targetAgentName, newPassword);
          if (success) {
            this.reset(); // Clear the form
          }
        });
      } else {
        form.addEventListener('submit', function(e) {
          e.preventDefault();
          saveFormData(this.id);
        });
        
        // Setup auto-save for this form
        setupAutoSave(form.id);
      }
    }
  });
}

function logout() {
  sessionStorage.removeItem('currentAgent');
  currentAgent = null;
  
  const loginPage = document.getElementById('loginPage');
  const dashboardPage = document.getElementById('dashboardPage');
  
  if (loginPage) loginPage.style.display = 'flex';
  if (dashboardPage) dashboardPage.style.display = 'none';
  
  toastManager.show('You have been logged out.', 'info');
}

// Compatibility function for existing code
function showToast(message, type = 'info') {
  toastManager.show(message, type);
}

// Enhanced data loading functions
function generateRecordId(agentName, formId) {
  const timestamp = new Date().getTime();
  const random = Math.random().toString(36).substring(2, 8);
  return `${agentName}_${formId}_${timestamp}_${random}`;
}

function populateForm(formId, data) {
  console.log(`Populating form ${formId} with data:`, data);
  const form = document.getElementById(formId);
  if (!form) {
    console.error(`Form with ID ${formId} not found`);
    return;
  }

  // Set record ID
  const recordIdInput = form.querySelector('input[name="record_id"]');
  if (recordIdInput) {
    if (data.record_id) {
      recordIdInput.value = data.record_id;
      console.log(`Set record_id to ${data.record_id}`);
    } else if (currentAgent) {
      const newRecordId = `${currentAgent.agentName}_${formId}`;
      recordIdInput.value = newRecordId;
      console.log(`Generated new record_id: ${newRecordId}`);
    }
  }

  // Set agent name fields
  const agentNameInput = form.querySelector('input[name="agentName"]');
  if (agentNameInput && currentAgent) {
    agentNameInput.value = currentAgent.agentName;
  }

  // Populate all other fields
  Object.keys(data).forEach(key => {
    const field = form.querySelector(`[name="${key}"]`);
    if (field) {
      if (field.type === 'checkbox') {
        field.checked = data[key] === true || data[key] === 'true' || data[key] === 1;
      } else if (field.type === 'radio') {
        if (field.value === data[key]) {
          field.checked = true;
        }
      } else {
        field.value = data[key] || '';
      }
      console.log(`Set ${key} to ${data[key]}`);
    }
  });

  console.log(`Form ${formId} populated successfully`);
}

// Load personal details data
async function loadPersonalDetails() {
  console.log('📋 loadPersonalDetails called');
  console.log('📋 currentAgent:', currentAgent);
  
  if (!currentAgent || !currentAgent.agentName) {
    console.error('❌ Cannot load personal details: No current agent');
    console.log('❌ currentAgent value:', currentAgent);
    showToast('Please log in to view your personal details', 'error');
    return;
  }
  
  console.log('📋 Loading personal details for', currentAgent.agentName);
  
  const statusElement = document.getElementById('personalFormSaveStatus');
  updateSaveStatus('Loading...', 'personalFormSaveStatus', 'loading');
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=getFormData&sheetName=Personal%20Details&sessionId=${encodeURIComponent(currentAgent.agentName)}`;
    const response = await makeApiCall(url);
    
    console.log('Personal Details Response:', response);
    
    if (response && !response.error) {
      populateForm('personalForm', response);
      updateSaveStatus('Data loaded!', 'personalFormSaveStatus', 'success');
      showToast('Personal details loaded successfully', 'success');
    } else {
      console.error('Error loading personal details:', response ? response.error : 'Unknown error');
      updateSaveStatus('Error loading data', 'personalFormSaveStatus', 'error');
      
      // Set default record ID if loading failed
      const recordIdInput = document.getElementById('personalRecordId');
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_personalForm`;
      }
      
      // Set agent name field
      const agentNameInput = document.querySelector('#personalForm input[name="agentName"]');
      if (agentNameInput) {
        agentNameInput.value = currentAgent.agentName;
      }
    }
    
  } catch (error) {
    console.error('Error loading personal details:', error);
    updateSaveStatus('Error loading data', 'personalFormSaveStatus', 'error');
    handleApiError(error, 'loading personal details');
  }
}

// Load all personal details (admin only)
async function loadAllPersonalDetails() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    console.error('Cannot load all personal details: Not an admin');
    return;
  }
  
  console.log('Loading all personal details (admin view)');
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=getAllPersonalDetails`;
    const response = await makeApiCall(url);
    
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
  } catch (error) {
    console.error('Error loading all personal details:', error);
    handleApiError(error, 'loading all personal details');
  }
}

// Load users (admin only)
async function loadUsers() {
  if (!currentAgent || currentAgent.role !== 'admin') {
    console.error('Cannot load users: Not an admin');
    toastManager.show('Admin access required to view users', 'error');
    return;
  }
  
  console.log('Loading users (admin view)');
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=getUsers`;
    const response = await makeApiCall(url);
    
    console.log('Users Response:', response);
    
    if (response && response.status === 'success' && response.users) {
      const usersTableBody = document.querySelector('#usersTableBody');
      if (!usersTableBody) {
        console.error('Users table body not found');
        return;
      }
      
      // Clear existing rows
      usersTableBody.innerHTML = '';
      
      if (response.users.length === 0) {
        usersTableBody.innerHTML = `
          <tr>
            <td colspan="4" class="text-center py-8 text-gray-500">
              <i class="fas fa-user-slash text-4xl mb-2 text-gray-300"></i>
              <p class="text-lg">No users found</p>
            </td>
          </tr>
        `;
        return;
      }
      
      // Add users to the table with enhanced styling
      response.users.forEach((user, index) => {
        const row = document.createElement('tr');
        row.className = 'hover:bg-gray-50 transition-colors';
        
        // Agent Name Cell
        const nameCell = document.createElement('td');
        nameCell.className = 'py-4 px-4';
        nameCell.innerHTML = `
          <div class="flex items-center">
            <div class="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold mr-3">
              ${user.agentName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div class="font-medium text-gray-900">${user.agentName}</div>
              <div class="text-sm text-gray-500">${user.email || 'No email'}</div>
            </div>
          </div>
        `;
        
        // Role Cell
        const roleCell = document.createElement('td');
        roleCell.className = 'py-4 px-4';
        const roleColor = user.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800';
        const roleIcon = user.role === 'admin' ? 'fas fa-crown' : 'fas fa-user';
        roleCell.innerHTML = `
          <span class="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${roleColor}">
            <i class="${roleIcon} mr-1"></i>
            ${(user.role || 'user').charAt(0).toUpperCase() + (user.role || 'user').slice(1)}
          </span>
        `;
        
        // Last Updated Cell
        const lastUpdatedCell = document.createElement('td');
        lastUpdatedCell.className = 'py-4 px-4 text-sm text-gray-900';
        const lastUpdated = user.lastUpdated ? new Date(user.lastUpdated).toLocaleDateString() : 'N/A';
        lastUpdatedCell.innerHTML = `
          <div class="flex items-center">
            <i class="fas fa-calendar-alt text-gray-400 mr-2"></i>
            ${lastUpdated}
          </div>
        `;
        
        // Actions Cell
        const actionsCell = document.createElement('td');
        actionsCell.className = 'py-4 px-4 text-center';
        actionsCell.innerHTML = `
          <div class="flex items-center justify-center space-x-2">
            <button class="edit-user-btn bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center" 
                    data-user="${user.agentName}">
              <i class="fas fa-edit mr-1"></i>Edit
            </button>
            <button class="delete-user-btn bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded-md text-sm font-medium transition-colors flex items-center" 
                    data-user="${user.agentName}">
              <i class="fas fa-trash mr-1"></i>Delete
            </button>
          </div>
        `;
        
        row.appendChild(nameCell);
        row.appendChild(roleCell);
        row.appendChild(lastUpdatedCell);
        row.appendChild(actionsCell);
        usersTableBody.appendChild(row);
      });
      
      // Add event listeners for action buttons
      document.querySelectorAll('.edit-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const userName = this.getAttribute('data-user');
          toastManager.show('User editing feature coming soon', 'info');
        });
      });
      
      document.querySelectorAll('.delete-user-btn').forEach(btn => {
        btn.addEventListener('click', function() {
          const userName = this.getAttribute('data-user');
          if (confirm(`Are you sure you want to delete user ${userName}?`)) {
            toastManager.show('User deletion feature coming soon', 'info');
          }
        });
      });
      
      toastManager.show(`Loaded ${response.users.length} users`, 'success');
    } else {
      console.error('Error loading users:', response ? response.message : 'Unknown error');
      toastManager.show('Error loading users', 'error');
    }
  } catch (error) {
    console.error('Error loading users:', error);
    handleApiError(error, 'loading users');
  }
}

// Change password functionality (admin only)
async function changeUserPassword(targetAgentName, newPassword) {
  if (!currentAgent || currentAgent.role !== 'admin') {
    console.error('Cannot change password: Not an admin');
    toastManager.show('Admin access required to change passwords', 'error');
    return;
  }
  
  console.log('Changing password for user:', targetAgentName);
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=changePassword&targetAgentName=${encodeURIComponent(targetAgentName)}&newPassword=${encodeURIComponent(newPassword)}&adminName=${encodeURIComponent(currentAgent.agentName)}`;
    const response = await makeApiCall(url);
    
    console.log('Change Password Response:', response);
    
    if (response && response.status === 'success') {
      toastManager.show(`Password changed successfully for ${targetAgentName}`, 'success');
      return true;
    } else {
      console.error('Error changing password:', response ? response.message : 'Unknown error');
      toastManager.show(response ? response.message : 'Error changing password', 'error');
      return false;
    }
  } catch (error) {
    console.error('Error changing password:', error);
    handleApiError(error, 'changing password');
    return false;
  }
}

// Populate user dropdown for change password
async function populateUserDropdown() {
  if (!currentAgent || currentAgent.role !== 'admin') return;
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=getUsers`;
    const response = await makeApiCall(url);
    
    if (response && response.status === 'success' && response.users) {
      const dropdown = document.getElementById('targetAgentName');
      if (dropdown) {
        // Clear existing options except the first one
        dropdown.innerHTML = '<option value="">-- Select User --</option>';
        
        // Add user options
        response.users.forEach(user => {
          const option = document.createElement('option');
          option.value = user.agentName;
          option.textContent = `${user.agentName} (${user.role})`;
          dropdown.appendChild(option);
        });
      }
    }
  } catch (error) {
    console.error('Error populating user dropdown:', error);
  }
}

// Setup forms with initial data
function setupProgressionsForm() {
  if (!currentAgent) return;
  
  console.log('Setting up progressions form');
  const form = document.getElementById('progressionsForm');
  if (!form) return;
  
  const recordIdInput = form.querySelector('input[name="record_id"]');
  const agentNameInput = form.querySelector('input[name="agentName"]');
  
  if (recordIdInput) {
    recordIdInput.value = `${currentAgent.agentName}_progressionsForm`;
  }
  if (agentNameInput) {
    agentNameInput.value = currentAgent.agentName;
  }
  
  // Load existing data
  loadFormData('progressionsForm');
}

function setupLicensingForm() {
  if (!currentAgent) return;
  
  console.log('Setting up licensing form');
  const form = document.getElementById('licensingForm');
  if (!form) return;
  
  const recordIdInput = form.querySelector('input[name="record_id"]');
  const agentNameInput = form.querySelector('input[name="agentName"]');
  
  if (recordIdInput) {
    recordIdInput.value = `${currentAgent.agentName}_licensingForm`;
  }
  if (agentNameInput) {
    agentNameInput.value = currentAgent.agentName;
  }
  
  // Load existing data
  loadFormData('licensingForm');
}

function setupCareerProgressionForm() {
  if (!currentAgent) return;
  
  console.log('Setting up career progression form');
  const form = document.getElementById('careerProgressionForm');
  if (!form) return;
  
  const recordIdInput = form.querySelector('input[name="record_id"]');
  const agentNameInput = form.querySelector('input[name="agentName"]');
  
  if (recordIdInput) {
    recordIdInput.value = `${currentAgent.agentName}_careerProgressionForm`;
  }
  if (agentNameInput) {
    agentNameInput.value = currentAgent.agentName;
  }
  
  // Load existing data
  loadFormData('careerProgressionForm');
}

// Generic form data loader
async function loadFormData(formId) {
  if (!currentAgent || !currentAgent.agentName) {
    console.error(`Cannot load ${formId} data: No current agent`);
    return;
  }
  
  const sheetName = formSheetMap[formId];
  if (!sheetName) {
    console.error(`No sheet mapping found for form: ${formId}`);
    return;
  }
  
  console.log(`Loading data for ${formId} from sheet: ${sheetName}`);
  
  const statusElementId = `${formId}SaveStatus`;
  updateSaveStatus('Loading...', statusElementId, 'loading');
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=getFormData&sheetName=${encodeURIComponent(sheetName)}&sessionId=${encodeURIComponent(currentAgent.agentName)}`;
    const response = await makeApiCall(url);
    
    console.log(`${formId} data response:`, response);
    
    if (response && !response.error) {
      populateForm(formId, response);
      updateSaveStatus('Data loaded!', statusElementId, 'success');
    } else {
      console.error(`Error loading ${formId} data:`, response ? response.error : 'Unknown error');
      updateSaveStatus('Error loading data', statusElementId, 'error');
      
      // Set default values
      const form = document.getElementById(formId);
      const recordIdInput = form.querySelector('input[name="record_id"]');
      const agentNameInput = form.querySelector('input[name="agentName"]');
      
      if (recordIdInput) {
        recordIdInput.value = `${currentAgent.agentName}_${formId}`;
      }
      if (agentNameInput) {
        agentNameInput.value = currentAgent.agentName;
      }
    }
  } catch (error) {
    console.error(`Error loading ${formId} data:`, error);
    updateSaveStatus('Error loading data', statusElementId, 'error');
  }
}

// Enhanced Dreams data functionality
function loadDreamsData() {
  if (!currentAgent || !currentAgent.agentName) {
    console.error('Cannot load dreams data: No current agent');
    return;
  }
  
  console.log('Loading dreams data for', currentAgent.agentName);
  loadFormData('dreamsForm');
}

// Load dashboard statistics
async function loadDashboardStats() {
  if (!currentAgent) return;
  
  try {
    const url = `https://script.google.com/macros/s/${scriptId}/exec?action=getDashboardStats&agent=${encodeURIComponent(currentAgent.agentName)}`;
    const response = await makeApiCall(url);
    
    if (response && response.status === 'success') {
      // Update dashboard stats
      document.getElementById('totalClients').textContent = response.totalClients || '0';
      document.getElementById('totalIncome').textContent = formatCurrency(response.totalIncome || 0);
      document.getElementById('completedTrainings').textContent = response.completedTrainings || '0';
      document.getElementById('newPartners').textContent = response.newPartners || '0';
    }
  } catch (error) {
    console.error('Error loading dashboard stats:', error);
  }
}

console.log('Enhanced script with complete functionality loaded successfully');