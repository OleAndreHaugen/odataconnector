const context = oEvent.oSource.getBindingContext();
const data = context.getObject();

data.joinTable = "";
data.joinFields = [];

modeloPageDetail.refresh();