const context = oEvent.oSource.getBindingContext();
const data = context.getObject();

controller.fieldOpenData = data;

if (!data.joinFields) {
    toolJoinFieldsUpdate.firePress();
} else {
    modeltabJoinFields.setData(data.joinFields);
}

diaJoinFields.open();
