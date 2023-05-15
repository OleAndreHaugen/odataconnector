modeldiaData.setData(modeloPageDetail.oData);

toolJoinFieldsFilter.setValue();
toolJoinFieldsFilter.fireLiveChange();

toolValueListKey.destroyItems();
toolValueListLabel.destroyItems();

modeltabJoinFields.oData.forEach(function (item) {
    toolValueListKey.addItem(new sap.ui.core.ListItem({ key: item.name, text: item.name }));
    toolValueListLabel.addItem(new sap.ui.core.ListItem({ key: item.name, text: item.name }));
});
