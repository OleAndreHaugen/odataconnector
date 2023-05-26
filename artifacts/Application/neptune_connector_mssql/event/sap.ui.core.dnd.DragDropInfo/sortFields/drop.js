let oDraggedControl = oEvent.getParameter("draggedControl");
let oDroppedControl = oEvent.getParameter("droppedControl");

let oDraggedContext = oDraggedControl.getBindingContext();
let oDroppedContext = oDroppedControl.getBindingContext();

if (!oDraggedContext && !oDroppedContext) return;

let oDraggedData = oDraggedContext.getObject();
let oDroppedData = oDroppedContext.getObject();

let indexDrag = 0;
let indexDrop = 0;

modeloPageDetail.oData.config.fields.forEach(function (data, i) {
    if (data.name === oDraggedData.name) indexDrag = i;
    if (data.name === oDroppedData.name) indexDrop = i;
});

sap.n.Planet9.arrayMove(modeloPageDetail.oData.config.fields, indexDrag, indexDrop);
modeloPageDetail.refresh();
