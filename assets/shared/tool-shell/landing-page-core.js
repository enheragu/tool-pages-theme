(function () {
  if (window.SharedToolLandingCore) return;

  function normalizeTool(raw, sectionId) {
    if (!raw || typeof raw !== 'object') return null;
    if (!raw.key || !raw.href) return null;

    return {
      key: String(raw.key),
      section: raw.section ? String(raw.section) : String(sectionId || ''),
      href: String(raw.href),
      imageDark: raw.imageDark ? String(raw.imageDark) : '',
      imageLight: raw.imageLight ? String(raw.imageLight) : '',
      title: raw.title ? String(raw.title) : '',
      desc: raw.desc ? String(raw.desc) : '',
      status: raw.status ? String(raw.status) : '',
    };
  }

  async function loadSectionCatalog(sectionDef) {
    if (!sectionDef || !sectionDef.catalogUrl) return [];

    var res = await fetch(sectionDef.catalogUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('Cannot fetch catalog: ' + sectionDef.catalogUrl);

    var payload = await res.json();
    var tools = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload.tools) ? payload.tools : []);

    return tools
      .map(function (item) { return normalizeTool(item, sectionDef.sectionId); })
      .filter(Boolean);
  }

  async function loadSectionCatalogs(sectionDefs) {
    var defs = Array.isArray(sectionDefs) ? sectionDefs : [];
    var chunks = await Promise.all(defs.map(function (def) {
      return loadSectionCatalog(def).catch(function () { return []; });
    }));

    var merged = [];
    for (var i = 0; i < chunks.length; i += 1) {
      merged = merged.concat(chunks[i]);
    }
    return merged;
  }

  window.SharedToolLandingCore = {
    loadSectionCatalogs: loadSectionCatalogs,
  };
})();
