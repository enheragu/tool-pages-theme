/**
 * SharedTabs – declarative tab-panel controller.
 *
 * Works with standard ARIA tab markup:
 *   <div role="tablist">
 *     <button role="tab" aria-selected="true"  aria-controls="panel-a">A</button>
 *     <button role="tab" aria-selected="false" aria-controls="panel-b">B</button>
 *   </div>
 *   <div id="panel-a" role="tabpanel">...</div>
 *   <div id="panel-b" role="tabpanel" class="hidden">...</div>
 *
 * Usage:
 *   const ctrl = window.SharedTabs.bind(tablistEl, {
 *     manageVisibility: true,            // show/hide panels via aria-controls (default: true)
 *     onSelect: (tabEl) => { ... },      // called after switching
 *   });
 *
 *   ctrl.select(tabEl);                  // programmatic switch
 *   ctrl.selectByDataset('method', 'rgbt'); // find tab by dataset key+value
 *
 * Auto-init:
 *   Add data-tabs-auto to any [role="tablist"] and call SharedTabs.autoInit()
 *   to bind all of them with default options.
 */
window.SharedTabs = (() => {
  'use strict';

  /**
   * Bind tab switching to a tablist element.
   * @param {HTMLElement} tablistEl
   * @param {object}      [opts]
   * @param {boolean}     [opts.manageVisibility=true]
   * @param {function}    [opts.onSelect]  called with (tabEl) after switching
   * @returns {{ select, selectByDataset }}
   */
  function bind(tablistEl, opts) {
    if (!tablistEl) return null;
    const { manageVisibility = true, onSelect } = opts || {};

    const tabs = Array.from(tablistEl.querySelectorAll('[role="tab"]'));

    function selectTab(activeTab) {
      tabs.forEach((tab) => {
        const isActive = tab === activeTab;
        tab.classList.toggle('active', isActive);
        tab.setAttribute('aria-selected', String(isActive));

        if (manageVisibility) {
          const panelId = tab.getAttribute('aria-controls');
          if (panelId) {
            const panel = document.getElementById(panelId);
            if (panel) panel.classList.toggle('hidden', !isActive);
          }
        }
      });

      if (typeof onSelect === 'function') onSelect(activeTab);
    }

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => selectTab(tab));
    });

    return {
      select: (tabEl) => selectTab(tabEl),
      selectByDataset: (key, value) => {
        const tab = tabs.find((t) => t.dataset[key] === value);
        if (tab) selectTab(tab);
      },
    };
  }

  /**
   * Bind all [role="tablist"][data-tabs-auto] elements with default options.
   */
  function autoInit() {
    document.querySelectorAll('[role="tablist"][data-tabs-auto]').forEach((el) => bind(el));
  }

  return { bind, autoInit };
})();
