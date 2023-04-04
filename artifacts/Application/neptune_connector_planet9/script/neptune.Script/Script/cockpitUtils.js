const cockpitUtils = {
    isCockpit: false,
    dataSet: null,
    dataSaved: null,
    requiredFields: [],

    init: function () {
        if (sap.n && sap.n.Planet9) cockpitUtils.isCockpit = true;

        if (!cockpitUtils.isCockpit) {
            // Hide Edit/Display Buttons
            butDetailSetEdit.setVisible(cockpitUtils.isCockpit);
            butDetailSetDisplay.setVisible(cockpitUtils.isCockpit);

            // ReadOnly Mode
            modelappControl.oData.enableEdit = true;
            modelappControl.refresh();
            return;
        }

        // Format Buttons
        sap.n.Planet9.formatButtonCreate(toolStartCreate);
        sap.n.Planet9.formatButtonRefresh(toolStartUpdate);
        sap.n.Planet9.formatButtonEdit(butDetailSetEdit);
        sap.n.Planet9.formatButtonDisplay(butDetailSetDisplay);
        sap.n.Planet9.formatButtonSave(butDetailSave);
        sap.n.Planet9.formatButtonDelete(butDetailDelete);
        sap.n.Planet9.formatButtonBack(butDetailBack);

        // ReadOnly Mode
        cockpitUtils.toggleEdit(false);

        // Custom Code

        // Set Lockhandler Object Name
        cockpitUtils.dataSet = "Open Edition Connector";

        // Required Fieldnames for data validation
        cockpitUtils.requiredFields = ["informDetailName", "informDetailTable"];
    },

    toggleEdit: function (editable) {
        if (!cockpitUtils.isCockpit) return;
        if (!editable) editable = false;

        butDetailSetEdit.setVisible(!editable);
        butDetailSetDisplay.setVisible(editable);

        modelappControl.oData.enableEdit = editable;
        modelappControl.refresh();

        if (modeloPageDetail.oData.id && editable) {
            butDetailDelete.setVisible(true);
        } else {
            butDetailDelete.setVisible(false);
        }

        // Cockpit Action
        sap.n.Planet9.setToolbarButton(editable);
        sap.n.Planet9.requiredFieldsClear(cockpitUtils.requiredFields);
    },

    toggleCreate: function () {
        if (!cockpitUtils.isCockpit) return;

        butDetailSetEdit.setVisible(false);
        butDetailSetDisplay.setVisible(false);
        butDetailDelete.setVisible(false);

        modelappControl.oData.enableEdit = true;
        modelappControl.refresh();

        // Cockpit Action
        sap.n.Planet9.setToolbarButton(true);
        sap.n.Planet9.requiredFieldsClear(cockpitUtils.requiredFields);
    },

    lock: function () {
        if (!cockpitUtils.isCockpit) return;

        oApp.setBusy(false);

        sap.n.Planet9.function({
            id: "Locking",
            method: "Lock",
            data: {
                objectType: cockpitUtils.dataSet,
                objectID: modeloPageDetail.oData.id,
                objectKey: modeloPageDetail.oData.name,
            },
            success: function (data) {
                oApp.setBusy(false);

                if (data.object) {
                    modeldiaLocked.setData(data.object);
                    sap.n.Planet9.lockCallback = butDetailSetEdit;
                    diaLocked.open();
                } else {
                    controller.get(modeloPageDetail.oData.id, true);
                }
            },
            error: (error) => oApp.setBusy(false),
        });
    },

    unlock: function () {
        if (!cockpitUtils.isCockpit) return;

        const toggleDisplay = () => {
            oApp.setBusy(false);
            controller.get(modeloPageDetail.oData.id, false);
        };

        var processFunction = function () {
            oApp.setBusy(true);

            sap.n.Planet9.function({
                id: "Locking",
                method: "Unlock",
                hideToast: true,
                data: {
                    objectType: cockpitUtils.dataSet,
                    objectID: modeloPageDetail.oData.id,
                },
                success: (data) => toggleDisplay(),
                error: (error) => {
                    toggleDisplay();
                    if (error.status !== 403) {
                        sap.m.MessageBox.error(error?.responseJSON?.status || error.status || "An error has ocurred");
                    }
                },
            });
        };

        // Check for changes
        if (cockpitUtils.dataSaved !== modeloPageDetail.getJSON()) {
            sap.n.Planet9.messageChange(processFunction);
        } else {
            processFunction();
        }
    },

    back: function () {
        var processFunction = function () {
            if (modelappControl.oData.enableEdit) {
                sap.n.Planet9.function({
                    id: "Locking",
                    method: "Unlock",
                    hideToast: true,
                    data: {
                        objectType: cockpitUtils.dataSet,
                        objectID: modeloPageDetail.oData.id,
                    },
                    success: function (data) {},
                    error: (error) => {
                        if (error.status !== 403) {
                            sap.m.MessageBox.error(error?.responseJSON?.status || error.status || "An error has ocurred");
                        }
                    },
                });
            }

            oApp.back();

            // Cockpit Action
            sap.n.Planet9.setToolbarButton(false);
        };

        // Check for changes
        if (modelappControl.oData.enableEdit && cockpitUtils.dataSaved !== modeloPageDetail.getJSON()) {
            sap.n.Planet9.messageChange(processFunction);
        } else {
            processFunction();
        }
    },
};

cockpitUtils.init();

if (sap.n) {
    sap.n.Shell.attachBeforeDisplay(localAppID, function (data) {
        toolStartUpdate.firePress();
    });
}
