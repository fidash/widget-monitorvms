/* global $,MashupPlatform,VmView,FIDASHRequests */
var Monitoring = (function () {
    "use strict";

    /***  AUTHENTICATION VARIABLES  ***/
    var url = "http://130.206.84.4:11027/monitoring/regions/";

    /*****************************************************************
    *                     C O N S T R U C T O R                      *
    *****************************************************************/

    function Monitoring() {
        this.regions = [];

        this.torequest = [];

        this.view   = "region";
        this.vmId = $("#vm").val();
        this.vmsByRegion = {};
        this.filtertext = "";
        this.options = {
            orderby: "",
            orderinc: "",
            data: {}
        };
        this.measures_status = {
            cpu: true,
            ram: true,
            disk: true
        };

        this.minvalues = {
            cpu: 0,
            ram: 0,
            disk: 0
        };

        this.variables = {
            regionSelected: MashupPlatform.widget.getVariable("regionSelected"),
            cpuOn: MashupPlatform.widget.getVariable("cpuOn"),
            ramOn: MashupPlatform.widget.getVariable("ramOn"),
            diskOn: MashupPlatform.widget.getVariable("diskOn"),
            sort: MashupPlatform.widget.getVariable("sort"),
            closed: MashupPlatform.widget.getVariable("closed")
        };

        this.comparef = or;

        // handleVariables.call(this);
        handlePreferences.call(this);
    }

    /******************************************************************
     *                P R I V A T E   F U N C T I O N S               *
    ******************************************************************/

    var or = function or() {
        var value = false;

        for (var i = 0; i < arguments.length; i++) {
            value = value || arguments[i];
        }

        return value;
    };

    var and = function and() {
        var value = true;

        for (var i = 0; i < arguments.length; i++) {
            value = value && arguments[i];
        }

        return value;
    };

    var updateHiddenVms = function updateHiddenVms() {
        // Use search bar?
        var mincpu = this.minvalues.cpu,
            minram = this.minvalues.ram,
            mindisk = this.minvalues.disk;

        $(".vmChart").each(function (index, vm) {
            var id = vm.id; // $(vm).prop("id");
            var data = this.options.data[id];
            if (!data) {
                return;
            }

            var cpu = parseFloat(data.cpu);
            var ram = parseFloat(data.ram);
            var disk = parseFloat(data.disk);

            var $elem = $(vm);
            if (this.comparef(cpu > mincpu, ram > minram, disk > mindisk)) {
                $elem.show();
            } else {
                $elem.hide();
            }
        }.bind(this));
    };

    var handlePreferences = function handlePreferences() {
        var checkValue = function checkValue(value, name) {
            if (Number.isNaN(value)) {
                MashupPlatform.widget.log("The preference for " + name + " is not a number.");
                return 0;
            }

            if (value < 0 || value > 100) {
                MashupPlatform.widget.log("The preference for " + name + " are not in the limits");
                return 0;
            }

            return value;
        };

        var cpu = checkValue(parseFloat(MashupPlatform.prefs.get("min-cpu")) || 0, "CPU");
        var ram = checkValue(parseFloat(MashupPlatform.prefs.get("min-ram")) || 0, "RAM");
        var disk = checkValue(parseFloat(MashupPlatform.prefs.get("min-disk")) || 0, "Disk");
        this.minvalues = {
            cpu: cpu,
            ram: ram,
            disk: disk
        };

        this.comparef = (parseInt(MashupPlatform.prefs.get("numbermin")) === 1) ? and : or;

        updateHiddenVms.call(this);
    };

    function drawVms(regions) {
        // $("#regionContainer").empty();
        // diff and only get news, and remove/hide unselected?
        if (regions.length > this.last_regions.length) {
            // add
            diffArrays(regions, this.last_regions)
                .forEach(drawVmsRegion.bind(this));
        } else if (regions.length < this.last_regions.length) {
            // remove
            diffArrays(this.last_regions, regions)
                .forEach(removeRegion.bind(this));
        }

        // regions.forEach(drawVm.bind(this));
        this.variables.regionSelected.set(regions.join(","));
        this.last_regions = regions;
    }

    function removeRegion(region) {
        // Remove all vms from the region
        $("." + region).remove();
        this.torequest = this.torequest.filter(function(x) {
            return x.region !== region;
        });
    }

    function drawVmsRegion(region) {
        var newurl = url + region + "/vms";

        FIDASHRequests.get(newurl, function (err, data) {
            if (err) {
                window.console.log(err);
                MashupPlatform.widget.log("The API seems down (Asking for region " + region + "): " + err.statusText);

                // The API are down, some test data
                // var vms2 = ["8dcc8045-a133-4f1b-b0da-f657de9ada06", "d1364ff1-498d-4acd-bbd2-0b83b8f05b18", "e2e5f578-637b-46b3-943e-0899453a35f6"];

                // if (region !== "Spain2") {
                //     vms2 = [];
                //     for(var i = 0; i < Math.floor(Math.random() * 100); i++) {
                //         vms2.push(Math.floor(Math.random() * 10000));
                //     }
                // }

                // this.vmsByRegion[region] = vms2;
                // vms2.forEach(function(h) {
                //     setTimeout(drawVm.bind(this, region, h), (Math.random() * 3000));
                //     // drawVm.call(this, region, h);
                // }.bind(this));
                return;
            }

            var startR = this.torequest.length === 0;

            // Data is a list of vms, let"s do one request by vm
            var vms = [];
            data.vms.forEach(function (x) {
                if (!!x.id && x.id !== "None") {
                    vms.push(x.id);
                    this.torequest.push({region: region, vm: x.id});
                }
            }.bind(this));

            this.vmsByRegion[region] = vms;

            if (startR) {
                startRequests.call(this);
            }
            // vms.forEach(drawVm.bind(this, region));
            // sortRegions.call(this);

            /* var view = new views[this.view]();
               var rdata = view.build(region, data, this.measures_status);
               this.options.data[rdata.region] = rdata.data;
             sortRegions.call(this); */
        }.bind(this));
    }

    function drawVm(region, vm) {
        var newurl  = url + region + "/vms/" + vm;
        FIDASHRequests.get(newurl, function (err, data) {
            if (err) {
                window.console.log(err);
                MashupPlatform.widget.log("The API seems down (Asking for VM " + vm + " in region " + region + "): " + err.statusText);

                // The API seems down
                // var h = createDefaultVm(region, vm);
                // var hdata2 = new VmView().build(region, vm, h, this.measures_status, this.minvalues, this.comparef, this.filtertext);
                // this.options.data[hdata2.id] = hdata2.data;
                // sortRegions.call(this);
                return;
            }

            if (isRegionSelected(region)) {
                var hdata = new VmView().build(region, vm, data, this.measures_status, this.minvalues, this.comparef, this.filtertext);
                this.options.data[hdata.id] = hdata.data;
                sortRegions.call(this);
            }

            startRequests.call(this); // "recursive" call
        }.bind(this));
    }

    function startRequests() {
        if (this.torequest.length === 0) {
            return;
        }

        var elem = this.torequest.shift();
        drawVm.call(this, elem.region, elem.vm);
    }

    function fillRegionSelector(regions) {
        regions.forEach(function (region) {
            $("<option>")
                .val(region)
                .text(region)
                .appendTo($("#region_selector"));
        });

        $("#region_selector")
            .prop("disabled", false);
        $("#region_selector").selectpicker({ title: "Choose Region" });
        $("#region_selector").selectpicker("refresh");
    }

    function diffArrays(a, b) {
        return a.filter(function (i) {return b.indexOf(i) < 0;});
    }

    // function mergeUnique(a, b) {
    //     return a.concat(b.filter(function (item) {
    //         return a.indexOf(item) < 0;
    //     }));
    // }

    function getAllOptions() {
        return $("#region_selector option").map(function (x, y) {
            return $(y).text();
        }).toArray();
    }

    function isRegionSelected(region) {
        return $("#region_selector").val().indexOf(region) > -1;
    }

    function filterNotRegion(regions) {
        var ops = getAllOptions();
        return regions.filter(function (i) {
            return ops.indexOf(i) >= 0;
        });
    }

    function setEvents() {
        $("#region_selector").change(function () {
            this.regions = $("#region_selector").val() || [];
            this.vmId = $("#vm").val();
            this.last_regions = this.last_regions || [];
            drawVms.call(this, this.regions);
        }.bind(this));

        $("#filterbox").keyup(function () {
            var text = $(arguments[0].target).val().toLowerCase();
            this.filtertext = text;
            if (text === "") {
                $(".filterhide").removeClass("filterhide");
            } else {
                $(".vmChart .regionTitle").each(function () {
                    var n = $(this).text();
                    var i = n.toLowerCase().indexOf(text);
                    if (i < 0) {
                        $("#" + n).addClass("filterhide");
                    } else {
                        $("#" + n).removeClass("filterhide");
                    }
                });
            }
        }.bind(this));

        $(".slidecontainer").click(function () {
            // var elem = $(x.target);
            // var closing = elem.text() === "^";
            var closing = this.variables.closed.get() === "true";
            closing = !closing;
            this.variables.closed.set("" + closing);
            if (closing) {
                $(".navbar").collapse("hide");
                $(".slidecontainer").removeClass("open").addClass("closed");
                $("#regionContainer").css("margin-top", "6px");

                // elem.text("v");
            } else {
                $(".navbar").collapse("show");
                $(".slidecontainer").removeClass("closed").addClass("open");
                $("#regionContainer").css("margin-top", "93px");

                // elem.text("^");
            }

            return false;
        }.bind(this));

        $("input[type='checkbox']").on("switchChange.bootstrapSwitch", function (e) {
            var type = e.target.dataset.onText;
            type = type.toLowerCase();

            var newst = !this.measures_status[type];
            this.measures_status[type] = newst;
            this.variables[type + "On"].set(newst.toString());
            if (newst) {
                // $("." + type).removeClass("hide");
                $("." + type).removeClass("myhide");
            } else {
                // $("." + type).addClass("hide");
                $("." + type).addClass("myhide");
            }

            // $("." + type).toggleClass("hide");
        }.bind(this));

        $(".sort").on("click", function (e) {
            var rawid = "#" + e.target.id;
            var id = e.target.id.replace(/sort$/, "");
            var rawmode = e.target.classList[3];
            var mode = rawmode.replace(/^fa-/, "");
            var oid = this.options.orderby;
            var orawid = "#" + oid + "sort";
            var newmode = "";
            if (id === oid) {
                if (mode === "sort") {
                    newmode = "sort-desc";
                    $(rawid).removeClass("fa-sort").addClass("fa-sort-desc");
                } else if (mode === "sort-desc") {
                    newmode = "sort-asc";
                    $(rawid).removeClass("fa-sort-desc").addClass("fa-sort-asc");
                } else {
                    newmode = "sort-desc";
                    $(rawid).removeClass("fa-sort-asc").addClass("fa-sort-desc");
                }
            } else {
                newmode = "sort-desc";
                if (oid !== "") {
                    var oldclass = $(orawid).attr("class").split(/\s+/)[3];
                    $(orawid).removeClass(oldclass).addClass("fa-sort");
                }

                $(rawid).removeClass(rawmode).addClass("fa-sort-desc");
            }

            this.options.orderby = id;
            this.options.orderinc = newmode;
            this.variables.sort.set(id + "//" + newmode);
            sortRegions.call(this);
        }.bind(this));
    }

    function sortRegions() {
        var by = this.options.orderby;
        var inc = this.options.orderinc;
        var data = this.options.data;
        if (inc === "") {
            return;
        }

        $(".vmChart").sort(function (a, b) {
            var dataA = data[a.id],
                dataB = data[b.id];
            var itemA = dataA[by],
                itemB = dataB[by];
            if (inc === "sort-asc") {
                // return itemA > itemB;
                return parseFloat(itemA) - parseFloat(itemB);
            }

            // return itemB > itemA;
            return parseFloat(itemB) - parseFloat(itemA);
        }).appendTo("#regionContainer");
    }

    // function calcMinHeight() {
    //     var minH = 9999;
    //     $(".regionChart").forEach(function (v) {
    //         if (v.height() < minH) {
    //             minH = v.height();
    //         }
    //     });
    // }

    function getRegionsMonitoring() {
        FIDASHRequests.get(url, function (err, data) {
            if (err) {
                window.console.log(err);
                MashupPlatform.widget.log("The API seems down (Asking for regions): " + err.statusText);

                // The API are down
                // var regionsT = ["Spain2", "Berlin2"];
                // fillRegionSelector(regionsT.sort());
                // selectSavedRegions.call(this);
                // this.regions = $("#region_selector").val() || [];
                return;
            }

            var regions = [];

            data._embedded.regions.forEach(function (region) {
                regions.push(region.id);
            });

            fillRegionSelector(regions.sort());
            selectSavedRegions.call(this);
            this.regions = $("#region_selector").val() || [];
        }.bind(this));
    }

    function receiveRegions(regionsRaw) {
        var regions = JSON.parse(regionsRaw);

        // Check it's a list
        var newRegions = filterNotRegion(regions);

        // Set in selector
        $("#region_selector").selectpicker("val", newRegions);

        this.regions = newRegions;
        this.last_regions = []; // Reset regions! :)
        // Empty before override
        $("#regionContainer").empty();
        drawVms.call(this, this.regions);
    }

    function handleSwitchVariable(name) {
        if (this.variables[name + "On"].get() === "") {
            this.variables[name + "On"].set("true");
        } else if (this.variables[name + "On"].get() !== "true") {
            this.measures_status[name] = false;
            $("." + name).addClass("myhide");
            $("#" + name + "Switch input[name='select-charts-region']").bootstrapSwitch("state", false, true);
        }
    }

    function selectSavedRegions() {
        // Get regions
        var regionsS = this.variables.regionSelected.get();
        var regions = regionsS.split(",");
        receiveRegions.call(this, JSON.stringify(regions));
    }

    function handleVariables() {
        handleSwitchVariable.call(this, "cpu");
        handleSwitchVariable.call(this, "ram");
        handleSwitchVariable.call(this, "disk");

        if (this.variables.closed.get() === "true") {
            $(".navbar").collapse("hide");
            $(".slidecontainer").removeClass("open").addClass("closed");
            $("#regionContainer").css("margin-top", "6px");
        } else {
            $(".slidecontainer").removeClass("closed").addClass("open");
            $("#regionContainer").css("margin-top", "93px");
        }

        var sort = this.variables.sort.get();
        var matchS = sort.match(/^(.+)\/\/(.+)$/);
        if (sort && matchS) {
            $("#" + matchS[1] + "sort").addClass("fa-" + matchS[2]);
            this.options.orderby = matchS[1];
            this.options.orderinc = matchS[2];
            sortRegions.call(this);
        }
    }

    /******************************************************************/
    /*                 P U B L I C   F U N C T I O N S                */
    /******************************************************************/

    Monitoring.prototype = {
        init: function () {
            $(".navbar").collapse();
            handleVariables.call(this);

            setEvents.call(this);

            getRegionsMonitoring.call(this);

            // Initialize switchs
            // $("[name='select-charts-vm']").bootstrapSwitch();
            $("[name='select-charts-region']").bootstrapSwitch();

            MashupPlatform.prefs.registerCallback(handlePreferences.bind(this));
            MashupPlatform.wiring.registerCallback("regions", receiveRegions.bind(this));
        }
    };

    return Monitoring;

})();
