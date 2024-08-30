const controller = {
    type: "mssql_migration",
    selectedSystem: null,
    init: async function () {
        jQuery.sap.require("sap.m.MessageBox");

        if (!cockpitUtils.isCockpit) {
            sap.m.MessageBox.confirm("Neptune MS SQL Server Connectors is only supported to run inside our Cockpit. Press OK and we will guide to to the right place.", {
                icon: sap.m.MessageBox.Icon.INFORMATION,
                title: "System Information",
                actions: [sap.m.MessageBox.Action.OK],
                initialFocus: "Ok",
                onClose: function (sAction) {
                    if (sAction === "OK") {
                        location.href = location.origin + "/cockpit.html#afconnector-mssql";
                    }
                },
            });
        }

        // /api/functions/Package/List
        const resPackage = await fetch("/api/functions/Package/List", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        const Package = await resPackage.json();
    },

    new: function () {
        modeloPageDetail.setData({
            name: "",
            description: "",
            metadata: {},
            config: {},
            type: controller.type,
        });

        tabDetail.setSelectedItem(tabDetailInfo);
        cockpitUtils.toggleCreate();
        cockpitUtils.dataSaved = modeloPageDetail.getJSON();
        oApp.to(oPageDetail);
    },

    delete: function () {
        sap.n.Planet9.objectDelete(function () {
            oApp.setBusy(true);
            sap.n.Planet9.setToolbarButton(false);

            apiDelete({
                parameters: {
                    id: modeloPageDetail.oData.id,
                },
            }).then(
                function (res) {
                    sap.m.MessageToast.show("Connector Deleted");
                    controller.list();
                    oApp.setBusy(false);
                    oApp.back();
                },
                function (error) {
                    oApp.setBusy(false);
                }
            );
        }, "MS SQL Server Connector");
    },

    save: function () {
        // Check Required Fields
        if (!sap.n.Planet9.requiredFieldsCheck(cockpitUtils.requiredFields)) {
            return;
        }

        apiSave({
            data: modeloPageDetail.oData,
        }).then(function (req) {
            if (req.message) {
                sap.m.MessageToast.show(req.message);
            }

            sap.m.MessageToast.show("Migration Saved");
            modeloPageDetail.oData.id = req.id;
            modeloPageDetail.oData.updatedAt = req.updatedAt;
            modeloPageDetail.oData.updatedBy = req.updatedBy;
            modeloPageDetail.oData.createdAt = req.createdAt || req.updatedAt;
            modeloPageDetail.oData.createdBy = req.createdBy;
            modeloPageDetail.refresh();
            controller.list();

            cockpitUtils.dataSaved = modeloPageDetail.getJSON();
            cockpitUtils.toggleEdit(true);
        });
    },

    get: function (id, editable) {
        apiGet({
            parameters: {
                id: id,
            },
        }).then(function (req) {
            modeloPageDetail.setData(req);

            if (oApp.getCurrentPage() === oPageStart) {
                tabDetail.setSelectedItem(tabDetailInfo);
            }

            oApp.to(oPageDetail);

            cockpitUtils.toggleEdit(editable);
            cockpitUtils.dataSaved = modeloPageDetail.getJSON();
        });
    },

    list: function () {
        apiList({
            parameters: {
                type: controller.type,
            },
        }).then(function (res) {
            modelappData.setData(res);
        });
    },

    openSchema: function () {
        if (!modeltabSchema.oData || !modeltabSchema.oData.length) toolSchemaUpdate.firePress();
        toolSchemaFilter.setValue();
        toolSchemaFilter.fireLiveChange();
        tabSchema.clearSelection();
        diaSchema.open();
    },

    getTables: async function () {
        tabTables.setBusy(true);

        apiGetTables({
            parameters: {
                dbid: modeloPageDetail.oData.systemid,
                schema_id: modeloPageDetail.oData.config.schema_id,
            },
        }).then(
            async function (res) {
                controller.selectedSystem = modeloPageDetail.oData.systemid;

                if (res.error) {
                    sap.m.MessageToast.show(res.error);
                } else {
                    const resDictionary = await fetch("/api/functions/Dictionary/List", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                    });

                    const Dictionary = await resDictionary.json();
                    if (Dictionary.dictionary) Dictionary = Dictionary.dictionary;

                    res?.forEach(function (item) {
                        const exists = ModelData.FindFirst(Dictionary, "name", controller.getTableNameP9(item.name));

                        if (exists) {
                            item.created = true;
                        } else {
                            item.created = false;
                        }
                    });

                    modeltabTables.setData(res);
                    tabDetailMigration.setCount(res.length);

                    tabTables.setBusy(false);
                }
            },
            function (error) {}
        );
    },

    getTableNameP9: function (name) {
        return (modeloPageDetail.oData.config.prefix + "_" + name).toLowerCase();
    },

    createTables: function () {
        modeltabTables.oData?.forEach(function (table) {
            if (table.selected && !table.created) {
                controller.getFieldsAndCreate(table);
            }
        });
    },

    getFieldsAndCreate: function (table) {
        apiGetFields({
            parameters: {
                dbid: modeloPageDetail.oData.systemid,
                table: table.name,
            },
        }).then(async function (res) {
            const tableData = {
                description: table.description,
                enableAudit: false,
                fields: controller.mapFields(res),
                ignoreWarning: false,
                includeDataInPackage: false,
                name: modeloPageDetail.oData.config.prefix + "_" + table.name,
                package: modeloPageDetail.oData.config.package,
                rolesRead: [],
                rolesWrite: [],
            };

            const resDictionary = await fetch("/api/functions/Dictionary/Save", {
                method: "POST",
                body: JSON.stringify(tableData),
                headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
            });

            if (resDictionary.status === 200) {
                ModelData.UpdateField(tabTables, "name", table.name, "created", true);
                ModelData.UpdateField(tabTables, "name", table.name, "status", "Table created successfully");
            } else {
                ModelData.UpdateField(tabTables, "name", table.name, "status", "Error creating table");
            }
        });
    },

    mapFields: function (fields) {
        let p9Fields = [];

        fields?.forEach(function (field) {

            // Prevent creation of auto P9 Fields
            if ((field.name).toLowerCase() === "id") return;
            if ((field.name).toLowerCase() === "createdat") return;
            if ((field.name).toLowerCase() === "updatedat") return;
            if ((field.name).toLowerCase() === "createdby") return;
            if ((field.name).toLowerCase() === "updatedby") return; 

            let p9Field = {
                fieldName: field.name,
                description: field.description ? field.description : "",
                id: ModelData.genID(),
                isNullable: true,
                isUnique: false,
            };

            switch (field.type) {
                case "int":
                case "smallint":
                    p9Field.fieldType = "integer";
                    break;

                case "bit":
                    p9Field.fieldType = "boolean";
                    break;

                case "bigint":
                    p9Field.fieldType = "bigint";
                    break;

                case "date":
                case "time":
                case "datetime2":
                case "datetimeoffset":
                case "datetime":
                case "smalldatetime":
                    p9Field.fieldType = "timestamptz";
                    break;

                default:
                    p9Field.fieldType = "text";
                    break;
            }

            p9Fields.push(p9Field);
        });

        return p9Fields;
    },

    loadData: function () {
        modeltabTables.oData?.forEach(async function (table) {
            if (table.selected && table.created) {
                // Counter from MSSQL
                apiCount({
                    parameters: {
                        dbid: modeloPageDetail.oData.systemid,
                        table: table.name,
                    },
                }).then(async function (res) {
                    ModelData.UpdateField(tabTables, "name", table.name, "numrec", res.db);

                    const resEntity = await fetch("/api/functions/Entity/Clear", {
                        method: "POST",
                        body: JSON.stringify({ table: controller.getTableNameP9(table.name) }),
                        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
                    });

                    if (resEntity.status === 200) {
                        ModelData.UpdateField(tabTables, "name", table.name, "status", `Table data cleared`);

                        // Need first field for ORDER BY
                        apiGetFields({
                            parameters: {
                                dbid: modeloPageDetail.oData.systemid,
                                table: table.name,
                            },
                        }).then(async function (fields) {
                            controller.startSync(table, res.db, fields[0].name);
                        });
                    }
                });
            }
        });
    },

    startSync: function (table, totRecords, orderBy) {
        const take = 50;
        let skip = 0;
        let totImported = 0;

        let maxPages = Math.ceil(totRecords / take);

        for (let i = 0; i < maxPages; i++) {
            apiExport({
                parameters: {
                    dbid: modeloPageDetail.oData.systemid,
                    table: table.name,
                    orderBy: orderBy,
                    take: take,
                    skip: skip,
                },
            }).then(async function (res) {
                totImported = totImported + res.length;

                const payload = {
                    table: controller.getTableNameP9(table.name),
                    data: res,
                };

                const resEntity = await fetch("/api/functions/Entity/Save", {
                    method: "POST",
                    body: JSON.stringify(payload),
                    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
                });

                if (resEntity.status === 200) {
                    ModelData.UpdateField(tabTables, "name", table.name, "status", `Imported ${totImported} / ${totRecords}`);
                }
            });

            skip = (i + 1) * take;
        }
    },
};

controller.init();
