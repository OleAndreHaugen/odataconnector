diaObjects.setBusy(true);

apiGetEntitities().then(function (res) {
    diaObjects.setBusy(false);

    if (res.error) {
        sap.m.MessageToast.show(res.error);
    } else {
        modeltabObjects.setData(res);
        diaObjects.setTitle("Open Edition Tables (" + res.length + ")");
    }
});
