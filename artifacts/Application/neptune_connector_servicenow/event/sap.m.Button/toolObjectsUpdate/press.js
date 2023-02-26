diaObjects.setBusy(true);

apiGetTables({
    parameters: {
        systemid: modeloPageDetail.oData.systemid,
    },
}).then(function (res) {
    diaObjects.setBusy(false);

    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabObjects.setData(res);
        diaObjects.setTitle("ServiceNow Tables (" + res.length + ")");
    }
});
