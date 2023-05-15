const context = oEvent.oSource.getBindingContext();
const data = context.getObject();

controller.fieldOpenData = data;

if (data.joinFields && data.joinFields.length) {
    modeltabJoinFields.setData(data.joinFields);
} else {
    toolJoinFieldsUpdate.firePress();
}

if (data.valueList) modeldiaJoinFields.setData(data.valueList);

diaJoinFields.open();
