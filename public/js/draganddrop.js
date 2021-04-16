var graph = new joint.dia.Graph();

// Initialise the canvas with the new graph
var paper = new joint.dia.Paper({
    el: document.getElementById('paper'),
    model: graph,
    width: 10000,
    height: 6000,
    gridSize: 5,
    snapLinks: true,
    linkPinning: false,
    defaultLink: new joint.shapes.logic.Wire,

    validateConnection: function (vs, ms, vt, mt, e, vl) {
        if (e === 'target') {

            // target requires an input port to connect
            if (!mt || !mt.getAttribute('class') || mt.getAttribute('class').indexOf('input') < 0) return false;

            // check whether the port is being already used
            var portUsed = this.model.getLinks().some(function (link) {
                return (link.id !== vl.model.id &&
                    link.get('target').id === vt.model.id &&
                    link.get('target').port === mt.getAttribute('port'));
            });

            return !portUsed;

        } else { // e === 'source'

            // source requires an output port to connect
            return ms && ms.getAttribute('class') && ms.getAttribute('class').indexOf('output') >= 0;
        }
    }
});

// zoom the viewport by 50%
paper.scale(1.5, 1.5);

function addGate(type) {
    addCell(type, {position: {x:100, y:125}})
}

function addCell(type, attrs) {
    let gate = null;
    switch (type) {
        case "logic.And":
            gate = new joint.shapes.logic.And(attrs);
            break;
        case "logic.Nand":
            gate = new joint.shapes.logic.Nand(attrs);
            break;
        case "logic.Or":
            gate = new joint.shapes.logic.Or(attrs);
            break;
        case "logic.Nor":
            gate = new joint.shapes.logic.Nor(attrs);
            break;
        case "logic.Xor":
            gate = new joint.shapes.logic.Xor(attrs);
            break;
        case "logic.Xnor":
            gate = new joint.shapes.logic.Xnor(attrs);
            break;
        case "logic.Not":
            gate = new joint.shapes.logic.Not(attrs);
            break;
        case "logic.Input":
            gate = new joint.shapes.logic.Input(attrs);
            break;
        case "logic.Output":
            gate = new joint.shapes.logic.Output(attrs);
            break;
        default:
            return;
    }
    graph.addCell(gate);
    return gate;
}

let circuitId = null;

function getElements() {
    let elements = [];
    graph.getCells().forEach(function (element) {
        const attr = element.attributes;
        if (element instanceof joint.shapes.logic.Wire) {
            elements.push({
                id: attr.id,
                type: attr.type,
                source: {id: attr.source.id, port: attr.source.port},
                target: {id: attr.target.id, port: attr.target.port}
            });
        } else {
            elements.push({id: attr.id, type: attr.type, position: attr.position});
        }
    });

    return elements;
}
function saveDiagram() {
    if(circuitId) {
        $.post("/users/savecircuit", { circuit_id: circuitId, name: $("#circuit_name").val(), elements: getElements() });
    }
}

function saveNewDiagram() {
    circuitId = $.post("/users/savecircuit", { name: $("#circuit_name").val(), elements: getElements() });
}


function loadCircuit(id) {
    circuitId = id;

    $.get("/users/circuit/" + circuitId, function(data) {
       let gates = {};
       let wires = [];

        $("#circuit_name").val(data.name);

       data.elements.forEach(cell => {
          if (cell.type === "logic.Wire") {
              wires.push(cell);
          } else {
              let gate = addCell(cell.type, {position: {x: parseInt(cell.position.x), y: parseInt(cell.position.y)}});
              gates[cell.id] = gate;
          }
       })

        for (let i = 0; i < wires.length; i++) {
            let w = wires[i];
            let wAttrs =  { source: { id: gates[w.source.id].id, port: w.source.port}, target: { id: gates[w.target.id].id, port: w.target.port }};
            graph.addCell(paper.getDefaultLink().set(wAttrs));
        }
    })
}