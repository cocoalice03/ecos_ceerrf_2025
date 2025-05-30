
// Utility to prevent custom element redefinition errors
export function preventCustomElementConflicts() {
  // Store original define method
  const originalDefine = window.customElements.define;
  
  // Override the define method to prevent redefinition
  window.customElements.define = function(name: string, constructor: any, options?: any) {
    // Check if element is already defined
    if (window.customElements.get(name)) {
      console.warn(`Custom element "${name}" is already defined. Skipping redefinition to prevent error.`);
      return;
    }
    
    // If not defined, proceed with original define
    try {
      return originalDefine.call(this, name, constructor, options);
    } catch (error) {
      console.error(`Error defining custom element "${name}":`, error);
      throw error;
    }
  };
  
  // Enhanced error handling for custom element conflicts
  const originalErrorHandler = window.addEventListener;
  
  // Intercept error events
  window.addEventListener('error', function(event) {
    if (event.error && event.error.message && event.error.message.includes('already been defined')) {
      console.warn('Prevented custom element redefinition error:', event.error.message);
      event.preventDefault();
      event.stopPropagation();
      return false;
    }
  }, true);
  
  // Intercept unhandled promise rejections
  window.addEventListener('unhandledrejection', function(event) {
    if (event.reason && event.reason.message && event.reason.message.includes('already been defined')) {
      console.warn('Prevented custom element redefinition promise rejection:', event.reason.message);
      event.preventDefault();
      return false;
    }
  });
}

// Function to scan and log all current custom elements
export function logCustomElements() {
  console.group('Custom Elements Registry Analysis');
  
  const knownProblematic = ['autosize-textarea', 'vite-error-overlay'];
  
  knownProblematic.forEach(name => {
    const element = window.customElements.get(name);
    if (element) {
      console.warn(`🚨 Problematic element "${name}" is defined:`, element);
    } else {
      console.log(`✅ Element "${name}" is not defined`);
    }
  });
  
  console.groupEnd();
}

// Function to detect the source of custom element definitions
export function detectCustomElementSources() {
  console.group('Script Sources Analysis');
  
  const scripts = Array.from(document.querySelectorAll('script'));
  const suspiciousSources = ['replit', 'overlay', 'webcomponents', 'vite'];
  
  scripts.forEach((script, index) => {
    const src = script.src || 'inline script';
    const isSuspicious = suspiciousSources.some(keyword => src.toLowerCase().includes(keyword));
    
    if (isSuspicious) {
      console.warn(`🔍 Suspicious script ${index + 1}:`, src);
    } else {
      console.log(`📄 Script ${index + 1}:`, src);
    }
  });
  
  console.groupEnd();
}
