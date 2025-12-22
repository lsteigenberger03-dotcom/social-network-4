(async function () {
  const container = document.getElementById("container");

  const res = await fetch("./data/network.json");
  if (!res.ok) throw new Error("network.json nicht gefunden");
  const data = await res.json();

  const Graph = graphology.Graph;
  const graph = new Graph({ type: "undirected" });

  function colorForType(t) {
    if (t === "Movie") return "#4c72b0";
    if (t === "Director") return "#55a868";
    if (t === "Actor") return "#dd8452";
    return "#999";
  }

  // Nodes
data.nodes.forEach(n => {
  graph.addNode(n.id, {
    // NICHT ...n (sonst kommt type="Movie" rein)
    label: n.label || n.id,

    // Sigma-Node-Type muss "circle" sein
    type: "circle",

    // dein eigener Typ unter anderem Namen
    nodeType: n.type,
    birthYear: n.birthYear,
    releaseYear: n.releaseYear,
    nationality: n.nationality,
    gender: n.gender,

    x: Math.random(),
    y: Math.random(),
    size: n.type === "Movie" ? 8 : n.type === "Director" ? 10 : 6,
    color:
      n.type === "Movie" ? "#4c72b0" :
      n.type === "Director" ? "#55a868" :
      "#dd8452"
  });
});


  // Edges
  data.edges.forEach((e, i) => {
    if (e.source === e.target) return;
    if (!graph.hasNode(e.source) || !graph.hasNode(e.target)) return;

    const key = "e" + i;
    if (!graph.hasEdge(key)) graph.addUndirectedEdgeWithKey(key, e.source, e.target);
  });

  const renderer = new Sigma(graph, container);


renderer.on("clickNode", (e) => {
  console.log(graph.getNodeAttributes(e.node));
});

})();
