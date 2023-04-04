const context = oEvent.oSource.getBindingContext();
const data = context.getObject();

controller.tableOpenBy = "Fields";
controller.tableOpenData = data;

controller.openTables();
