// This a polyfill. If a feature isn't supported in a browser then this will provide a workaround or patch for it.
SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function (toElement) {
    return toElement.getScreenCTM().inverse().multiply(this.getScreenCTM());
};

/*

 */
class Connector {

    constructor() {
        this.id = `connector_${++nextUid}`; // The id attribute uniquely identifies a connection in the diagram
        this.dragType = "connector";        // Identifies this instance as a connector for dragging and dropping
        this.isSelected = false;            // Todo: To be used later for selecting and removing a connector
        this.element = connectorElement.cloneNode(true); // Uses the connector template to create a new SVG connector
        this.path = this.element.querySelector(".connector-path"); // References to the connector path SVG element, used to draw the line
        this.pathOutline = this.element.querySelector(".connector-path-outline"); // References to the connector path outline SVG element, used to draw the outline
        this.inputHandle = this.element.querySelector(".input-handle"); // References to the input handle of the connector
        this.outputHandle = this.element.querySelector(".output-handle"); // References to the output handle of the connector
    }

    /*
    Initialising the connection
     */
    init(port) {
        connectorLayer.appendChild(this.element); // Adding a newly created SVG connection to the diagram
        this.isInput = port.isInput;

        // Determines which part of the connector to hold in place and which part to drag:
        if (port.isInput) {
            this.inputPort = port;
            this.dragElement = this.outputHandle;
            this.staticElement = this.inputHandle;
        } else {
            this.outputPort = port;
            this.dragElement = this.inputHandle;
            this.staticElement = this.outputHandle;
        }
        5
        this.staticPort = port;

        // Todo: Describe the significance of the data-drag attributes that I am setting here
        this.dragElement.setAttribute("data-drag", `${this.id}:connector`);
        this.staticElement.setAttribute("data-drag", `${port.id}:port`);

        // Setup the connector drag animation
        TweenLite.set([this.inputHandle, this.outputHandle], {
            x: port.global.x,
            y: port.global.y });
    }

    /*
    Calculates the path between two logic gates representing a connection and updates the SVG path to draw a bezier curved line.
     */
    updatePath() {

        // Calculates the co-ordinates for input and output handles
        const x1 = this.inputHandle._gsTransform.x;
        const y1 = this.inputHandle._gsTransform.y;

        const x4 = this.outputHandle._gsTransform.x;
        const y4 = this.outputHandle._gsTransform.y;

        // Multiply the curve intensity by the difference between the input and output ports of two gates
        const dx = Math.abs(x1 - x4) * bezierWeight;

        const p1x = x1;
        const p1y = y1;

        const p2x = x1 - dx;
        const p2y = y1;

        const p4x = x4;
        const p4y = y4;

        const p3x = x4 + dx;
        const p3y = y4;

        // Plot the path after calculating the four co-ordinates
        const data = `M${p1x} ${p1y} C ${p2x} ${p2y} ${p3x} ${p3y} ${p4x} ${p4y}`;

        // Draw the connection using the referenced SVG path
        this.path.setAttribute("d", data);
        this.pathOutline.setAttribute("d", data);

    }

    /*
    Keeps the path connected to the port while the logic gates are being moved
     */
    updateHandle(port) {

        // Starts the connector drag animation
        if (port === this.inputPort) {

            TweenLite.set(this.inputHandle, {
                x: port.global.x,
                y: port.global.y });


        } else if (port === this.outputPort) {

            TweenLite.set(this.outputHandle, {
                x: port.global.x,
                y: port.global.y });

        }

        this.updatePath();
    }

    /*
    Checks weather the path drawn has connected to the port, if the port and the path overlap then places the connection in the port
    */
    placeHandle() {
        const skipShape = this.staticPort.parentNode.element;
        let hitPort;

        // Go through all the gates to check if the connection falls on one of their inputs or outputs:
        for (let gate of gates) {
            if (gate.element === skipShape) {
                continue;
            }

            // Check if the connection overlaps one of the gates
            if (Draggable.hitTest(this.dragElement, gate.element)) {
                const ports = this.isInput ? gate.outputs : gate.inputs;

                // Check if the connection overlaps a port on one of the gates
                for (let port of ports) {
                    if (Draggable.hitTest(this.dragElement, port.portElement)) {
                        hitPort = port;
                        break;
                    }
                }

                // Break out of the loop if a port has been identified
                if (hitPort) {
                    break;
                }
            }
        }

        // If a port has been identified then add this connector to the port and redraw the path
        if (hitPort) {

            if (this.isInput) {
                this.outputPort = hitPort;
            } else {
                this.inputPort = hitPort;
            }

            this.dragElement.setAttribute("data-drag", `${hitPort.id}:port`);

            hitPort.addConnector(this); // Add this connector to the identified port
            this.updateHandle(hitPort); // Redraw the connection to this port

        } else { // If a port has not been identified then remove the connection
            this.remove();
        }
    }

    /*
     Removes the path if it is dragged and not connected to a port
     */
    remove() {

        // Removes the connector from the identified port
        if (this.inputPort) {
            this.inputPort.removeConnector(this);
        }

        if (this.outputPort) {
            this.outputPort.removeConnector(this);
        }

        this.isSelected = false;

        // Removes the referenced SVG element from the identified port
        this.path.removeAttribute("d");
        this.pathOutline.removeAttribute("d");


        this.dragElement.removeAttribute("data-drag");
        this.staticElement.removeAttribute("data-drag");

        this.staticPort = null;
        this.inputPort = null;
        this.outputPort = null;
        this.dragElement = null;
        this.staticElement = null;

        connectorLayer.removeChild(this.element); // Removes the newly created SVG connection from the diagram
        connectorPool.push(this);
    }

    /*
    Draw the path continuously while the connection is being dragged
     */
    onDrag() {
        this.updatePath();
    }
    /*
    Place the connector on the port once the connection is no longer being dragged
     */
    onDragEnd() {
        this.placeHandle();
    }}


//
// NODE PORT
// ===========================================================================
class NodePort {

    constructor(parentNode, element, isInput) {

        this.id = `port_${++nextUid}`;
        this.dragType = "port";

        this.parentNode = parentNode;
        this.isInput = isInput;

        this.element = element;
        this.portElement = element.querySelector(".port");
        this.portScrim = element.querySelector(".port-scrim");

        this.portScrim.setAttribute("data-drag", `${this.id}:port`);

        this.connectors = [];
        this.lastConnector;

        const bbox = this.portElement.getBBox(); // Get the smallest rectangle in which this element fits and return the co-ordinates

        this.global = svg.createSVGPoint();
        this.center = svg.createSVGPoint();
        this.center.x = bbox.x + bbox.width / 2;
        this.center.y = bbox.y + bbox.height / 2;

        this.update();
    }

    createConnector() {

        let connector;

        if (connectorPool.length) {
            connector = connectorPool.pop();
            connectorLookup[connector.id] = connector;
        } else {
            connector = new Connector();
        }

        connector.init(this);
        this.lastConnector = connector;
        this.connectors.push(connector);
    }

    removeConnector(connection) {

        const index = this.connectors.indexOf(connection);

        if (index > -1) {
            this.connectors.splice(index, 1);
        }
    }

    addConnector(connection) {
        this.connectors.push(connection);
    }

    update() {

        const transform = this.portElement.getTransformToElement(diagramElement);
        this.global = this.center.matrixTransform(transform);

        for (let connector of this.connectors) {
            connector.updateHandle(this);
        }
    }}


//
// NODE SHAPE
// ===========================================================================
class NodeShape {

    constructor(element, x, y) {

        this.id = `shape_${++nextUid}`;
        this.dragType = "shape";

        element.setAttribute("data-drag", `${this.id}:shape`);

        this.element = element;
        this.dragElement = element;

        TweenLite.set(element, { x, y });

        const inputElements = Array.from(element.querySelectorAll(".input-field"));
        const outputElements = Array.from(element.querySelectorAll(".output-field"));

        this.inputs = inputElements.map(element => {
            const port = new NodePort(this, element, true);
            portLookup[port.id] = port;
            ports.push(port);
            return port;
        });

        this.outputs = outputElements.map(element => {
            const port = new NodePort(this, element, false);
            portLookup[port.id] = port;
            ports.push(port);
            return port;
        });
    }

    onDrag() {

        for (let input of this.inputs) {
            input.update();
        }

        for (let output of this.outputs) {
            output.update();
        }
    }}


//
// DIAGRAM
// ===========================================================================
class Diagram {

    constructor() {

        this.dragElement = this.element = diagramElement;
        shapeElements.forEach((element, i) => {
            const shape = new NodeShape(element, 50 , 50 + i * 100);
            shapeLookup[shape.id] = shape;
            gates.push(shape);
        });

        this.target = null;
        this.dragType = null;

        this.dragTarget = this.dragTarget.bind(this);
        this.prepareTarget = this.prepareTarget.bind(this);
        this.stopDragging = this.stopDragging.bind(this);

        this.draggable = new Draggable(dragProxy, {
            allowContextMenu: true,
            trigger: svg,
            onDrag: this.dragTarget,
            onDragEnd: this.stopDragging,
            onPress: this.prepareTarget });

    }

    stopDragging() {
        this.target.onDragEnd && this.target.onDragEnd();
    }

    prepareTarget(event) {

        let element = event.target;
        let drag;

        while (!(drag = element.getAttribute("data-drag")) && element !== svg) {if (window.CP.shouldStopExecution(0)) break;
            element = element.parentNode;
        }window.CP.exitedLoop(0);

        drag = drag || "diagram:diagram";
        const split = drag.split(":");
        const id = split[0];
        const dragType = split[1];

        switch (dragType) {
            case "diagram":
                this.target = this;
                break;

            case "shape":
                this.target = shapeLookup[id];
                break;

            case "port":
                const port = portLookup[id];
                port.createConnector();
                this.target = port.lastConnector;
                this.dragType = this.target.dragType;
                break;

            case "connector":
                this.target = connectorLookup[id];
                break;}

    }

    dragTarget() {

        TweenLite.set(this.target.dragElement, {
            x: `+=${this.draggable.deltaX}`,
            y: `+=${this.draggable.deltaY}` });


        this.target.onDrag && this.target.onDrag();
    }}


//
// APP
// ===========================================================================

let nextUid = 0;

const bezierWeight = 0.675;//shape of the path

const svg = document.querySelector("#svg");
const diagramElement = document.querySelector("#diagram");

const shapeLookup = {};
const portLookup = {};
const connectorLookup = {};

const ports = [];//port stack
const gates = [];//shape stack
const connectorPool = [];

const dragProxy = document.querySelector("#drag-proxy");
const shapeElements = Array.from(document.querySelectorAll(".node-container"));

const frag = document.createDocumentFragment();
frag.appendChild(document.querySelector(".connector"));
const connectorElement = frag.querySelector(".connector");
const connectorLayer = document.querySelector("#connections-layer");

const diagram = new Diagram();

