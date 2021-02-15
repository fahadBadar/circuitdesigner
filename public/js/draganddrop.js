SVGElement.prototype.getTransformToElement = SVGElement.prototype.getTransformToElement || function (toElement) {
    return toElement.getScreenCTM().inverse().multiply(this.getScreenCTM());
};
// This a polyfill. If a feature isn't supported in a browser then this will provide a workaround or patch for it.

//
// CONNECTOR
// ===========================================================================
class Connector {

    constructor() {
        //defines all the variables
        this.id = `connector_${++nextUid}`;
        this.dragType = "connector";//weather it is a connector or a gate
        this.isSelected = false;
        this.element = connectorElement.cloneNode(true);
        this.path = this.element.querySelector(".connector-path");
        this.pathOutline = this.element.querySelector(".connector-path-outline");
        this.inputHandle = this.element.querySelector(".input-handle");//differentiate between inputs and outputs so a path can only be drawn through oppposites
        this.outputHandle = this.element.querySelector(".output-handle");
    }

    init(port) {

        connectorLayer.appendChild(this.element);// adds an element to the end of a list of elements this being a port

        this.isInput = port.isInput;

        if (port.isInput) {//if it is an input port
            this.inputPort = port;
            this.dragElement = this.outputHandle;//it will receive from the output
            this.staticElement = this.inputHandle;//and wont receive from another input
        } else {//otherwise
            this.outputPort = port;//it has to be an output port
            this.dragElement = this.inputHandle;//it will receive from an input
            this.staticElement = this.outputHandle;// and not another output
        }

        this.staticPort = port;
        this.dragElement.setAttribute("data-drag", `${this.id}:connector`);
        this.staticElement.setAttribute("data-drag", `${port.id}:port`);
        //applies the attributes to the corresponding port/connector

        TweenLite.set([this.inputHandle, this.outputHandle], {
            x: port.global.x,
            y: port.global.y });//drag the path from input to output



    }

    updatePath() {

        const x1 = this.inputHandle._gsTransform.x;//x co-ordinate of the input port
        const y1 = this.inputHandle._gsTransform.y;//y co-ordinate of the input port

        const x4 = this.outputHandle._gsTransform.x;//x co-ordinate of the output port
        const y4 = this.outputHandle._gsTransform.y;//y co-ordinate of the output port

        const dx = Math.abs(x1 - x4) * bezierWeight;//the absolute (positive) value of the difference between the two ports lengthwise * curve intensity

        const p1x = x1;
        const p1y = y1;

        const p2x = x1 - dx;
        const p2y = y1;

        const p4x = x4;
        const p4y = y4;

        const p3x = x4 + dx;
        const p3y = y4;
        //the constants are reassigned so the original value isn't changed

        const data = `M${p1x} ${p1y} C ${p2x} ${p2y} ${p3x} ${p3y} ${p4x} ${p4y}`;//array of position to draw  path

        this.path.setAttribute("d", data);
        this.pathOutline.setAttribute("d", data);
        //the information above is then passed to the method that draws the paths
    }

    updateHandle(port) {

        if (port === this.inputPort) {

            TweenLite.set(this.inputHandle, {//input handle is the thing that is being changed
                x: port.global.x, //from input
                y: port.global.y });//to output draw path


        } else if (port === this.outputPort) {

            TweenLite.set(this.outputHandle, {
                x: port.global.x,
                y: port.global.y });

        }

        this.updatePath();
    }

    placeHandle() {

        const skipShape = this.staticPort.parentNode.element;

        let hitPort;

        for (let shape of shapes) {//for each shape

            if (shape.element === skipShape) {// if the element is the same data type as skipShape then continue
                continue;
            }

            if (Draggable.hitTest(this.dragElement, shape.element)) {//if it is on screen

                const ports = this.isInput ? shape.outputs : shape.inputs;

                for (let port of ports) {//for each port

                    if (Draggable.hitTest(this.dragElement, port.portElement)) {//if the dragged path is over another port
                        hitPort = port;//connect the two ports
                        break;
                    }
                }

                if (hitPort) {
                    break;
                }
            }
        }

        if (hitPort) {

            if (this.isInput) {
                this.outputPort = hitPort;
            } else {
                this.inputPort = hitPort;
            }

            this.dragElement.setAttribute("data-drag", `${hitPort.id}:port`);

            hitPort.addConnector(this);//push a
            this.updateHandle(hitPort);

        } else {
            this.remove();
        }
    }

    remove() {

        if (this.inputPort) {
            this.inputPort.removeConnector(this);
        }

        if (this.outputPort) {
            this.outputPort.removeConnector(this);
        }

        this.isSelected = false;

        this.path.removeAttribute("d");
        this.pathOutline.removeAttribute("d");
        this.dragElement.removeAttribute("data-drag");
        this.staticElement.removeAttribute("data-drag");

        this.staticPort = null;
        this.inputPort = null;
        this.outputPort = null;
        this.dragElement = null;
        this.staticElement = null;

        connectorLayer.removeChild(this.element);
        connectorPool.push(this);
    }//clears all variables so it can move on to he next connector

    onDrag() {
        this.updatePath();//while dragging keep updating the path
    }

    onDragEnd() {
        this.placeHandle();//then stop when the user stops dragging
    }}


//
// NODE PORT
// ===========================================================================
class NodePort {

    constructor(parentNode, element, isInput) {

        this.id = `port_${++nextUid}`;//set the id to the id given in the html
        this.dragType = "port";

        this.parentNode = parentNode;
        this.isInput = isInput;

        this.element = element;
        this.portElement = element.querySelector(".port");//
        this.portScrim = element.querySelector(".port-scrim");

        this.portScrim.setAttribute("data-drag", `${this.id}:port`);

        this.connectors = [];
        this.lastConnector;

        const bbox = this.portElement.getBBox();//get the smallest space in which this element fits and return the co-ordinates

        this.global = svg.createSVGPoint();
        this.center = svg.createSVGPoint();
        this.center.x = bbox.x + bbox.width / 2;
        this.center.y = bbox.y + bbox.height / 2;

        this.update();
    }

    createConnector() {

        let connector;

        if (connectorPool.length) {//check if the list of connectors is empty
            connector = connectorPool.pop();//if not assign the first connector in the list to the variable "connector"
            connectorLookup[connector.id] = connector;//find a an id that matches the connector name
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

        shapeElements.forEach((element, i) => {//for each element
            const shape = new NodeShape(element, 50 , 50 + i * 100);// create a new shape and stagger the location of the shapes so they are side by side
            shapeLookup[shape.id] = shape;//find the shape
            shapes.push(shape);// and add anything else to the shape
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
        }window.CP.exitedLoop(0);//error checker

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
            y: `+=${this.draggable.deltaY}` });//method that drags the whole logic gate


        this.target.onDrag && this.target.onDrag();
    }}


//
// APP
// ===========================================================================

//

let nextUid = 0;

const bezierWeight = 0.675;//shape of the path

const svg = document.querySelector("#svg");
const diagramElement = document.querySelector("#diagram");

const shapeLookup = {};
const portLookup = {};
const connectorLookup = {};

const ports = [];//port stack
const shapes = [];//shape stack
const connectorPool = [];

const dragProxy = document.querySelector("#drag-proxy");
const shapeElements = Array.from(document.querySelectorAll(".node-container"));

const frag = document.createDocumentFragment();
frag.appendChild(document.querySelector(".connector"));
const connectorElement = frag.querySelector(".connector");
const connectorLayer = document.querySelector("#connections-layer");

const diagram = new Diagram();
