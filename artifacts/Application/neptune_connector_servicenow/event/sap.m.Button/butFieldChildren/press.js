const context = oEvent.oSource.getBindingContext();
const data = context.getObject();
controller.getFields(data.reference_table, data);