(async function () {
  const container = document.getElementById("container");
  const sidepanel = document.getElementById("sidepanel");
  const searchInput = document.querySelector(".search");
  const btnReset = document.querySelector(".btnrow .btn:nth-child(1)");
  const btnCenter = document.querySelector(".btnrow .btn:nth-child(2)");

  // --- Daten laden
  const res = await fetch("./data/network.json");
  if (!res.ok) throw new Error("network.json nicht gefunden");
  const data = await res.json();

  // --- Graph erstellen (undirected)
  const Graph = graphology.Graph;
  const graph = new Graph({ type: "undirected" });

  function colorForNodeType(t) {
    if (t === "Movie") return "#2b7bbb";
    if (t === "Director") return "#55a868";
    if (t === "Actor") return "#7a7a7a";
    return "#999";
  }

  // Nodes: WICHTIG -> Sigma erwartet type="circle", dein Typ heißt nodeType
  data.nodes.forEach((n) => {
    graph.addNode(n.id, {
      label: n.label || n.id,
      type: "circle",
      nodeType: n.type,               // Movie/Actor/Director
      birthYear: n.birthYear ?? null,
      releaseYear: n.releaseYear ?? null,
      nationality: n.nationality ?? null,
      gender: n.gender ?? null,
      x: Math.random(),
      y: Math.random(),
      size: n.type === "Movie" ? 8 : n.type === "Director" ? 10 : 6,
      color: colorForNodeType(n.type),
      _baseColor: colorForNodeType(n.type) // merken fürs Reset/Highlight
    });
  });

  // Edges
  data.edges.forEach((e, i) => {
    if (e.source === e.target) return;
    if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) return;
    graph.addUndirectedEdgeWithKey(`e${i}`, e.source, e.target);
  });

  

  // --- Sigma Renderer
  const renderer = new Sigma(graph, container);
  const camera = renderer.getCamera();

  // --- State
  let activeNode = null;   // aktuell ausgewählt (Click)
  let searchedNode = null; // aktuell aus Suche

  // Hilfsfunktionen
  function setPanelEmpty() {
    sidepanel.innerHTML = `
      <h2>No node selected</h2>
      <p>Search or click on an actor or a movie in the network.</p>
    `;
  }

  function setPanelForNode(nodeId) {
    const a = graph.getNodeAttributes(nodeId);
    const neighbors = graph.neighbors(nodeId);

    // Movie: Anzahl Actor-Nachbarn
    let extra = "";
    if (a.nodeType === "Movie") {
      const actorCount = neighbors.filter((n) => graph.getNodeAttribute(n, "nodeType") === "Actor").length;
      extra = `<div style="margin-top:10px;color:#555;font-size:16px;">Verbunden mit Actors: <b>${actorCount}</b></div>`;
    }

    sidepanel.innerHTML = `
      <h2 style="margin:0 0 10px 0;">${escapeHtml(a.label)}</h2>
      <div style="color:#555;font-size:16px;margin-bottom:10px;">${escapeHtml(a.nodeType || "")}</div>

      <div style="font-size:16px;line-height:1.5;color:#333;">
        ${a.birthYear ? `<div><b>Birth Year:</b> ${a.birthYear}</div>` : ""}
        ${a.releaseYear ? `<div><b>Release Year:</b> ${a.releaseYear}</div>` : ""}
        ${a.nationality ? `<div><b>Nationality:</b> ${escapeHtml(a.nationality)}</div>` : ""}
        ${a.gender ? `<div><b>Gender:</b> ${escapeHtml(a.gender)}</div>` : ""}
      </div>

      ${extra}
    `;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- Highlighting über Reducer
  renderer.setSetting("nodeReducer", (node, attrs) => {
    const out = { ...attrs };

    const focus = searchedNode || activeNode;
    if (!focus) return out;

    const neigh = graph.neighbors(focus);
    const isFocus = node === focus;
    const isNeighbor = neigh.includes(node);

    if (isFocus) {
      out.zIndex = 2;
      out.size = Math.max(attrs.size, 10);
      out.color = "#111";
    } else if (isNeighbor) {
      out.zIndex = 1;
      out.size = Math.max(attrs.size, 8);
      out.color = attrs._baseColor || attrs.color;
    } else {
      out.color = "#e0e0e0";
      out.label = ""; // Labels ausblenden für Unwichtiges
    }

    return out;
  });

  renderer.setSetting("edgeReducer", (edge, attrs) => {
    const out = { ...attrs };

    const focus = searchedNode || activeNode;
    if (!focus) return out;

    const s = graph.source(edge);
    const t = graph.target(edge);
    const neigh = graph.neighbors(focus);
    const keep =
      (s === focus && neigh.includes(t)) ||
      (t === focus && neigh.includes(s)) ||
      (neigh.includes(s) && neigh.includes(t) && (s === focus || t === focus));

    if (!keep) out.hidden = true;
    return out;
  });

  function refresh() {
    renderer.refresh();
  }

  // --- Suche: Label match (case-insensitive)
  function findNodeByQuery(q) {
    const query = q.trim().toLowerCase();
    if (!query) return null;

    // 1) exakter Label-Treffer bevorzugt
    let exact = null;
    graph.forEachNode((id, attrs) => {
      if (exact) return;
      if ((attrs.label || "").toLowerCase() === query) exact = id;
    });
    if (exact) return exact;

    // 2) sonst erster "contains"-Treffer
    let first = null;
    graph.forEachNode((id, attrs) => {
      if (first) return;
      if ((attrs.label || "").toLowerCase().includes(query)) first = id;
    });
    return first;
  }

  function focusCameraOnNode(nodeId) {
    const { x, y } = graph.getNodeAttributes(nodeId);
    camera.animate({ x, y, ratio: 0.6 }, { duration: 600 });
  }

  // --- Events
  // Klick auf Node -> Panel füllen + highlight
  renderer.on("clickNode", (e) => {
    activeNode = e.node;
    searchedNode = null; // Klick überschreibt Suche (wenn du das nicht willst, sag)
    if (searchInput) searchInput.value = "";
    setPanelForNode(activeNode);
    focusCameraOnNode(activeNode);
    refresh();
  });

  // Klick ins Leere -> Auswahl weg
  renderer.on("clickStage", () => {
    activeNode = null;
    searchedNode = null;
    if (searchInput) searchInput.value = "";
    setPanelEmpty();
    refresh();
  });

  // Suche tippen -> highlight + neighbors + panel noch NICHT ändern (du wolltest: Node+Nachbarn highlight)
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      const nodeId = findNodeByQuery(searchInput.value);
      searchedNode = nodeId;
      if (nodeId) {
        focusCameraOnNode(nodeId);
      }
      refresh();
    });

    // Enter -> wie Klick: Panel füllen
    searchInput.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter") {
        const nodeId = findNodeByQuery(searchInput.value);
        if (nodeId) {
          activeNode = nodeId;
          searchedNode = null;
          setPanelForNode(activeNode);
          focusCameraOnNode(activeNode);
          refresh();
        }
      }
    });
  }

  // Reset -> alles zurück
  if (btnReset) {
    btnReset.addEventListener("click", () => {
      activeNode = null;
      searchedNode = null;
      if (searchInput) searchInput.value = "";
      setPanelEmpty();
      if (camera.animatedReset) camera.animatedReset();
      else camera.animate({ x: 0, y: 0, ratio: 1 }, { duration: 400 });
      refresh();
    });
  }

  // Zentrieren -> nur Kamera reset
  if (btnCenter) {
    btnCenter.addEventListener("click", () => {
      if (camera.animatedReset) camera.animatedReset();
      else camera.animate({ x: 0, y: 0, ratio: 1 }, { duration: 400 });
    });
  }

  // Startzustand
  setPanelEmpty();
  refresh();
})();
