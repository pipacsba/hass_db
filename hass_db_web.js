const http = require('http');
var fs = require('fs');
var initSqlJs = require('sql.js');
var path = require('path');

//server info
const hostname = '127.0.0.1';
const port = 3000;

//where are the db files stored on the srver?
var filelist = [];
//var db_path="Y:\\hass";
//var db_path = "C:\\cygwin64\\home\\agoston.lorincz\\hass_db";
var db_path="c:\\Users\\agoston.lorincz\\Documents\\NetBeansProjects\\hass_db_web";
var db_name = "";

//define input for combo chart (currently only 1 is supported)
var c_unit = "\\u00b0C";
var c_added_text_entities = [["sensor.hitachi_relay", "sensor.netatmo_relay"], ["sensor.cooling_target_temp", "sensor.heating_target_temp"]];
var c_actuator_summary = [];

//some overall variables
var astr = '';
var entities = [];
var text_timeline = "[";
var max_date = new Date(0);
var min_date = new Date();
var unit_types = {};
var text_type = 0;

//init SQL.js
initSqlJs();

//create server response
const server = http.createServer((req, res) => {
    //collect *.db files
    filelist = [];
    fs.readdirSync(db_path).forEach(file => {
        if (/\.db$/.test(file))
        {
            var stats = fs.statSync(db_path + "\\" + file);
            var fileSizeInBytes = parseInt(stats["size"] / 1024 / 1024);
            filelist.push(file + "," + fileSizeInBytes + "MB");
        }
    });
    //create some varibales
    var this_text_timeline = [];
    var url_obj = new URL(req.url, `http://${req.headers.host}`);
    //get the from and to dates selected by the frontend
    var req_from = url_obj.searchParams.get('From');
    var req_to = url_obj.searchParams.get('To');
    var prev_db_name = db_name;
    //get the name of the frontend selected database
    db_name = url_obj.searchParams.get('Database');
    if (db_name === null) {
        db_name = prev_db_name;
    }
    if (db_name !== prev_db_name && db_name !== "") {
        load_database(db_path + "\\" + db_name);
    }
    //if the base path is requested, create the page
    if (url_obj.pathname === "/")
    {
        //define from->to dates which makes sense if the fronted selected does not
        if (req_from && req_to)
        {
            from_date = new Date(req_from);
            from_date.setHours(0);
            from_date.setMinutes(0);
            from_date.setSeconds(0);
            to_date = new Date(req_to);
            to_date.setHours(23);
            to_date.setMinutes(59);
            to_date.setSeconds(59);
            if (min_date > from_date) {
                from_date = min_date;
            }
            if (max_date < to_date) {
                to_date = max_date;
            }

        } else
        {
            from_date = min_date;
            to_date = max_date;
        }
        // there is selected from->to dates, create the charts' script for the frontend
        if (from_date >= to_date) {
            this_text_timeline = [];
        } else
        {
            this_text_timeline = filter_text_timeline(from_date, to_date);
            g_script = get_line_charts(from_date, to_date);
            combo_chart = get_combo_charts(from_date, to_date, c_unit, c_added_text_entities);
        }

        //some server response stuff
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/html');

        //pagebegin -> always required
        var pagebegin = `
			<style type="text/css">
				html, body {
					background-color: transparent;
				}
			</style>`;
        //only required, if db is selected - includes all the charts' scripts
        var pagechart1_script = "";
        if (db_name !== "") {
            pagechart1_script = `
			<script type="text/javascript" src="https://www.gstatic.com/charts/loader.js"></script>
			<script type="text/javascript">
				google.charts.load("current", {packages:["timeline","corechart"]});
				google.setOnLoadCallback(drawChart_timeline);
				function drawChart_timeline() 
				{
					var data = new google.visualization.DataTable();
					data.addColumn({ type: 'string', id: 'Entity' });
					data.addColumn({ type: 'string', id: 'State' });
					data.addColumn({ type: 'datetime', id: 'Start' });
					data.addColumn({ type: 'datetime', id: 'End' });
					data.addRows(` + this_text_timeline + `);
					var tl_chart = new google.visualization.Timeline(document.getElementById(\'timeline\'));
					var options = {
						chartArea:{left:0,top:0,width:"80%",height:"80%"}
						,height: ` + (text_type + 1) * 44 + `
						,legend:{position:'top',alignment:'start'}
						,hAxis: {
							title: "Date",
							gridlines: { count: 3, },
							format: "dd-MMM hh:mm"}
					};
					tl_chart.draw(data, options);
				}
				` + combo_chart[0] + g_script[0] + `
			</script>`;
        }
        //pagemid: always required
        var pagemid1 = "\n</head>\n<body>\n";
        //create db selection dropdown from the databases in the selected folder
        var db_select = `
			<form action="/">
				<select name="Database" id="db">\n`;
        for (i = 0; i < filelist.length; i++)
        {
            db_select = db_select + "<option value='" + filelist[i].split(",", 1);
            var this_db_name = filelist[i].split(",", 1).toString();
            if (this_db_name === db_name)
            {
                db_select = db_select + "' selected ";
            } else
            {
                db_select = db_select + "'";
            }
            db_select = db_select + ">" + filelist[i] + "</option>\n";
        }
        db_select = db_select + `\n</select>
				<input type="submit" value="Select DataBase">
			</form>\n`;
        //only if db is selected, create a select for the from->to dates
        var from_to_select = "";
        if (db_name !== "")
        {
            from_to_select = `
			<form action="/">
				From: <input type="date" name="From" min="` + min_date.toISOString().split('T')[0] + `"	 max="` + max_date.toISOString().split('T')[0] + `">
				To: <input type="date" name="To" max="` + max_date.toISOString().split('T')[0] + `"	 min="` + min_date.toISOString().split('T')[0] + `">
			<input type="submit">
			</form>\n`;
        }
        //create frontend space for the timeline chart
        var pagechart_timeline = "";
        if (db_name !== "") {
            pagechart_timeline = '<div id="timeline"></div>\n';
        }
        //pageend always required, the web browser will wait for it
        var pageend = "</body>\n</html>\n";

        //send the frontend
        res.write(pagebegin);
        res.write(pagechart1_script);
        res.write(pagemid1);
        res.write(db_select);
        //write some other useful stuff to the frontend, than make spece for the charts
        if (db_name !== "")
        {
            res.write("The " + db_name + " contains data from " + min_date.toISOString().split('T')[0] + " to " + max_date.toISOString().split('T')[0] + "<BR>\n");
            res.write("Charts created from " + new Date(from_date - (from_date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) + " to " + new Date(to_date - (from_date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) + "<BR>\n");
            res.write(from_to_select);
            res.write(pagechart_timeline);
            res.write(combo_chart[1]);
            for (i = 0; i < c_actuator_summary.length; i++)
            {
                res.write(c_added_text_entities[0][i] + " was used for " + parseInt(c_actuator_summary[i] / 1000 / 60 / 60) + "h " + new Date(c_actuator_summary[i]).getUTCMinutes() + "min <BR>");
            }
            res.write(g_script[1]);
        }
        res.write(pageend);
        res.end();
    }
});

//start the server
server.listen(port, hostname, () => {
    console.log(`Server running at http://${hostname}:${port}/`);
});

//create data for the text type timeline chart
function filter_text_timeline(from_date, to_date)
{
    from_date = new Date(from_date);
    to_date = new Date(to_date);
    var a_text_timeline = "[\n";
    text_type = 0;
    //go through of all entities
    for (var key in entities)
    {
        var entity = entities[key];
        //if the entity is a text type entity, than create the data
        if (entity.unit === "text")
        {
            //count how many text type element exsits
            text_type = text_type + 1;
            data_used = 0;
            var prevdata = [];
            //if this is not the first entity in the answer, then add a comma
            if (a_text_timeline.length > 5)
            {
                a_text_timeline = a_text_timeline + ',\n';
            }
            //and go through on all the data
            for (i = 0; i < entity.data.length; i++)
            {
                adata = entity.data[i];
                //if data is in the required time range
                if (new Date(adata[1]) < to_date && new Date(adata[1]) > from_date)
                {
                    //this is the first data from this entity
                    if (data_used === 0)
                    {
                        //this is the firts data of the entity
                        if (i === 0)
                        {
                            a_text_timeline = a_text_timeline + "\t\t\t\t\t\t[\"" + entity.entity_id + "\",\"" + "unknown" + "\",new Date(" + from_date.getTime() + "),";
                        }
                        //this is not the first data of the entity
                        else
                        {
                            a_text_timeline = a_text_timeline + "\t\t\t\t\t\t[\"" + entity.entity_id + "\",\"" + prevdata[0] + "\",new Date(" + from_date.getTime() + "),";
                        }
                    }
                    data_used = 1;
                    //finish the previous line, and start the next (the end-date of each data line is in the next measurement data)
                    a_text_timeline = a_text_timeline + "new Date(" + new Date(adata[1]).getTime() + ")],\n\t\t\t\t\t\t[\"" + entity.entity_id + "\",\"" + adata[0] + "\",new Date(" + new Date(adata[1]).getTime() + "),";

                }
                //save the data, it will be required to finish the line
                prevdata = adata;
            }
            //extend the last change of state to end of the requested time
            if (data_used === 1)
            {
                a_text_timeline = a_text_timeline + "new Date(" + to_date.getTime() + ")]";
            }
        } else
        {

        }
    }
    //close the data array
    a_text_timeline = a_text_timeline + "]";
    //and clean it up
    while (a_text_timeline.includes(",\n,"))
    {
        a_text_timeline = a_text_timeline.replace(/,\n,/, ",");
    }

    return a_text_timeline;
}

//create data for the numeric timeline charts per unit
function filter_timeline(from_date, to_date, unit)
{
    from_date = new Date(from_date);
    to_date = new Date(to_date);
    var a_timeline = "[\n";
    //how many entities are using the current unit?
    //go through all entities
    for (var key in entities)
    {
        var entity = entities[key];
        //if the unit matches, than it is a go
        if (entity.unit === unit)// && a_timeline.length<3)
        {
            leading_text = "";
            found = 0;
            tailing_text = "";
            //create null elements for the other entities who uses the same unit
            for (i = 0; i < unit_types[unit].length; i++)
            {
                if (unit_types[unit][i] === entity.entity_id)
                {
                    found = 1;
                } else
                {
                    if (found === 0) {
                        leading_text = leading_text + "null,";
                    }
                    if (found === 1) {
                        tailing_text = tailing_text + ",null";
                    }
                }
            }

            data_used = 0;
            //go through the data of the entity
            for (i = 0; i < entity.data.length; i++)
            {
                adata = entity.data[i];

                //if data is in the required time range
                if (new Date(adata[1]) < to_date && new Date(adata[1]) > from_date)
                {
                    if (adata[0] !== "unknown" && adata[0] !== "")
                    {
                        //if this is not the first entity in the answer, then add a comma
                        if (a_timeline.length > 5)
                        {
                            a_timeline = a_timeline + ',\n';
                        }
                        //create data line
                        a_timeline = a_timeline + "\t\t\t\t[new Date(" + new Date(adata[1]).getTime() + ")," + leading_text + adata[0] + tailing_text + "]";
                    }
                }
            }
        }
    }
    //clean up the result
    a_timeline = a_timeline + "]";
    a_timeline = a_timeline.replace(/,\n,/, ",");

    return a_timeline;
}

//create data for combo chart
function filter_combochart(identifiers, from_date, to_date)
{
    from_date = new Date(from_date);
    to_date = new Date(to_date);
    var timeline_db = [];
    //how many entities are using this unit?
    var unit_used_by = unit_types[identifiers[0]].length;
    //go through the entities
    for (var key in entities)
    {
        var entity = entities[key];
        //if this is an entity that using the specified unit, than collect the data
        if (entity.unit === identifiers[0])// && a_timeline.length<3)
        {
            var leading_text = "";
            var found = 0;
            var tailing_text = "";
            var a_id = 0;
            //create nulls for the other data columns
            for (i = 0; i < unit_used_by + identifiers[1][0].length; i++)
            {
                if (unit_types[identifiers[0]][i] === entity.entity_id)
                {
                    found = 1;
                    a_id = i;
                } else
                {
                    if (found === 0) {
                        leading_text = leading_text + "null,";
                    }
                    if (found === 1) {
                        tailing_text = tailing_text + ",null";
                    }
                }
            }
            //and go through the data
            for (i = 0; i < entity.data.length; i++)
            {
                adata = entity.data[i];

                //if data is in the required time range
                if (new Date(adata[1]) < to_date && new Date(adata[1]) > from_date)
                {
                    if (adata[0] !== "unknown" && adata[0] !== "" && adata[0] !== "None")
                    {
                        var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                        this_db_row[0] = new Date(adata[1]).getTime();
                        this_db_row[a_id + 1] = parseFloat(adata[0]);
                        timeline_db.push(this_db_row);
                    }
                }
            }

        }
        //if the unit does not match, but to be shown in the combo chart
        else if (identifiers[1][0].includes(entity.entity_id) > 0)
        {
            var identifier_id;
            var leading_text = "";
            var tailing_text = "";
            var found = 0;
            var found_target = 0;
            var a_id = 0;
            //again, create nulls for the other columns
            //first the added entities (not sharing the unit)
            for (i = 0; i < identifiers[1][0].length; i++)
            {
                if (identifiers[1][0][i] === entity.entity_id)
                {
                    found = 1;
                    identifier_id = i;
                    a_id = i + unit_used_by;
                } else
                {
                    if (found === 0) {
                        leading_text = leading_text + "null,";
                    }
                    if (found === 1) {
                        tailing_text = tailing_text + ",null";
                    }
                }
            }
            //but also the base entities
            for (i = 0; i < unit_used_by; i++)
            {
                if (unit_types[identifiers[0]][i] === identifiers[1][1][identifier_id])
                {
                    found_target = 1;
                    b_id = i;
                } else if (found_target === 1)
                {
                    tailing_text = tailing_text + "null,";
                } else
                {
                    leading_text = leading_text + "null,";
                }
            }

            //create sum for the actuator active time
            c_actuator_summary[identifier_id] = 0;
            //and browse through the data
            for (i = 0; i < entity.data.length; i++)
            {
                adata = entity.data[i];

                //if data is in the required time range
                if (new Date(adata[1]) < to_date && new Date(adata[1]) > from_date)
                {
                    if (adata[0] !== "unknown" && adata[0] !== "" && adata[0] !== "None" && adata[0] !== "idle" && adata[0] !== "off" && adata[0] !== "unavailable")
                    {
                        //start_date is found
                        var actuator_start = new Date(adata[1]);
                        //find end_date
                        var actuator_end = new Date(adata[1]);
                        var actuator_end_found = 0;
                        //seach end date of actuation
                        while (actuator_end_found === 0)
                        {
                            i = i + 1;
                            if (typeof entity.data[i][0] === 'undefined')
                            {
                                actuator_end = to_date;
                            } else if (entity.data[i][0] !== adata[0])
                            {
                                actuator_end_found = 1;
                                actuator_end = entity.data[i][1];
                            }
                        }
                        //revert i with one (if ith is not equal it does not mean if )
                        i = i - 1;
                        //find start and end values of the corresponding entity
                        var start_data = 0;
                        var end_data = 0;

                        //get the entity which contains the target of the actuation
                        for (var akey in entities)
                        {
                            if (entities[akey].entity_id === identifiers[1][1][identifier_id])
                            {
                                var this_entity = entities[akey];
                            }
                        }
                        //and search for the collect target value (for the actuation start and end date, might be different)
                        for (j = 0; j < this_entity.data.length; j++)
                        {
                            p_data = this_entity.data[j];
                            //as the measurements are asynchronous, before start date collect both start and end dates
                            if (new Date(p_data[1]) <= actuator_start) {
                                start_data = p_data[0];
                                end_data = p_data[0];
                            } else if (new Date(p_data[1]) <= actuator_end && new Date(p_data[1]) > actuator_start)
                            {
                                //after the start date only update the start date
                                end_data = p_data[0];
                                //except if no data for the start date
                                if (start_data === 0) {
                                    start_data = p_data[0];
                                }
                            } else
                            {
                                //and continue till the end if start or end date is not found
                                if (start_data === 0) {
                                    start_data = p_data[0];
                                }
                                if (end_data === 0) {
                                    end_data = p_data[0];
                                }
                            }
                        }
                        //if possible calculate the start and the end date difference
                        if (typeof c_actuator_summary[identifier_id] === 'undefined')
                        {
                            c_actuator_summary[identifier_id] = actuator_end.getTime() - actuator_start.getTime();
                        } else
                        {
                            c_actuator_summary[identifier_id] = c_actuator_summary[identifier_id] + actuator_end.getTime() - actuator_start.getTime();
                        }

                        //create data for the start
                        var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                        this_db_row[0] = new Date(actuator_start).getTime();
                        this_db_row[a_id + 1] = parseFloat(start_data);
                        timeline_db.push(this_db_row);

                        //create data for the end
                        var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                        this_db_row[0] = new Date(actuator_end).getTime();
                        this_db_row[a_id + 1] = parseFloat(end_data);
                        timeline_db.push(this_db_row);
                        //insert null line for the sake of the chart
                        var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                        this_db_row[0] = new Date(actuator_end).getTime();
                        timeline_db.push(this_db_row);

                        //insert additional data into the original target data for each start and end dates (again, the chart needs it)
                        var afound = 0;
                        for (j = 0; j < timeline_db.length; j++)
                        {
                            //if the element if not undefined, we found the right block in the datatable for the current item
                            if (typeof timeline_db[j][b_id + 1] !== 'undefined')
                            {
                                afound = 1;
                                if (timeline_db[j][0] > new Date(actuator_start).getTime())
                                {
                                    var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                                    this_db_row[0] = new Date(actuator_start).getTime();
                                    this_db_row[b_id + 1] = parseFloat(start_data);
                                    timeline_db.splice(j, 0, this_db_row);
                                    afound = 2;
                                    break;
                                }
                            }
                            //even if the target entity does not contain data at the specified time (probably no change before)
                            else if (afound === 1)
                            {
                                var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                                this_db_row[0] = new Date(actuator_start).getTime();
                                this_db_row[b_id + 1] = parseFloat(start_data);
                                timeline_db.splice(j, 0, this_db_row);
                                afound = 2;
                                break;
                            }
                        }
                        bfound = 0;
                        for (j = 0; j < timeline_db.length; j++)
                        {
                            //if the element if not undefined, we found the right block in the datatable for the current item
                            if (typeof timeline_db[j][b_id + 1] !== 'undefined')
                            {
                                bfound = 1;
                                if (timeline_db[j][0] > new Date(actuator_end).getTime())
                                {
                                    var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                                    this_db_row[0] = new Date(actuator_end).getTime();
                                    this_db_row[b_id + 1] = parseFloat(end_data);
                                    timeline_db.splice(j, 0, this_db_row);
                                    afound = 2;
                                    break;
                                }
                            } else if (bfound === 1)
                            {
                                var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                                this_db_row[0] = new Date(actuator_end).getTime();
                                this_db_row[b_id + 1] = parseFloat(end_data);
                                timeline_db.splice(j, 0, this_db_row);
                                afound = 2;
                                break;
                            }
                        }
                        //if no measurement found for the target, add it to the beginning of the datatable
                        if (afound === 0 && bfound === 0)
                        {
                            var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                            this_db_row[0] = new Date(actuator_start).getTime();
                            this_db_row[b_id + 1] = parseFloat(start_data);
                            timeline_db.splice(0, 0, this_db_row);

                            var this_db_row = Array.apply(null, Array(unit_used_by + identifiers[1][0].length + 1)).map(function () {});
                            this_db_row[0] = new Date(actuator_end).getTime();
                            this_db_row[b_id + 1] = parseFloat(end_data);
                            timeline_db.splice(0, 0, this_db_row);
                        }
                    }
                }
            }
        }
    }
    //convert to text, and clean up
    b_timeline = JSON.stringify(timeline_db);
    b_timeline = b_timeline.replace(/\],\[/g, "],\n\t\t\t\t[");
    b_timeline = b_timeline.replace(/[0-9]{13}/ig, "new Date($&)");

    //return a_timeline;
    return b_timeline;
}

//create line chart scripts
function get_line_charts(from_date, to_date)
{
    var script_text = "";
    var div_text = "";
    var count = 0;
    //for each unit
    for (var aunit in unit_types)
    {
        if (count < 100)
        {
            count = count + 1;
            //first the script
            script_text = script_text + linechart_script(aunit, from_date, to_date, count);
            //than the frontend location
            div_text = div_text + "<div id='line" + count + "'></div>\n";
        }
    }
    return [script_text, div_text];
}

//create combo charts
function get_combo_charts(from_date, to_date, c_unit, c_added_text_entities)
{
    var script_text = "";
    var count = 0;
    var div_text = "";
    for (var aunit in unit_types)
    {

        if (aunit === c_unit)
        {
            count = count + 1;
            //first the script
            script_text = script_text + combochart_script([aunit, c_added_text_entities], from_date, to_date, count);
            //then the frontend location
            div_text = div_text + "<div id='combo" + count + "'></div>\n";
        }
    }
    return [script_text, div_text];
}

//create linechart script
function linechart_script(unit, from_date, to_date, count)
{
    //defnie new function
    var script_text = `
		google.setOnLoadCallback(drawChart_` + count + `);
		function drawChart_` + count + `() 
		{
			var data = new google.visualization.DataTable();
			data.addColumn('datetime','time' );`;
    //define columns
    script_text = script_text + "\n";
    for (i = 0; i < unit_types[unit].length; i++)
    {
        script_text = script_text + "\t\t\tdata.addColumn('number','" + unit_types[unit][i] + "');\n";
    }
    //add data
    script_text = script_text + `
			data.addRows(` + filter_timeline(from_date, to_date, unit) + `);
			var formatNumer = new google.visualization.NumberFormat({pattern: '#.## \\'[` + unit + `]', fractionDigits: 2});`;
    script_text = script_text + "\n";
    //some number formatting (specially for % data, which does not need 100x multiplication)
    for (i = 0; i < unit_types[unit].length; i++)
    {
        var j = i + 1;
        script_text = script_text + "\t\t\tformatNumer.format(data, " + j + ");\n";
    }
    //set some options
    script_text = script_text + `
			var chart = new google.visualization.LineChart(document.getElementById(\'line` + count + `\'));
			var options = {
				chart: {
					subtitle: '[` + unit + `]'
				},
				areaOpacity: 0,
				legend: { 
					position: 'top' 
				},
				hAxis: {
					title: "Date",
					format: "dd-MMM hh:mm"},
			};
			chart.draw(data, options);
		};
		`;
    return script_text;
}

//create combochart scripts
function combochart_script(identifiers, from_date, to_date, count)
{
    //define the function
    var script_text = `
		google.setOnLoadCallback(drawCombo_` + count + `);
		function drawCombo_` + count + `() 
		{
			var data = new google.visualization.DataTable();
			data.addColumn('datetime','time' );
`;
    //name the columns
    for (i = 0; i < unit_types[identifiers[0]].length; i++)
    {
        script_text = script_text + "\t\t\tdata.addColumn('number','" + unit_types[identifiers[0]][i] + "');\n";
    }
    for (i = 0; i < identifiers[1][0].length; i++)
    {
        script_text = script_text + "\t\t\tdata.addColumn('number','" + identifiers[1][0][i] + "');\n";
    }
    //add the data
    script_text = script_text + `
			data.addRows(` + filter_combochart(identifiers, from_date, to_date) + `);
			var formatNumer = new google.visualization.NumberFormat({pattern: '#.## \\'[` + identifiers[0] + `]', fractionDigits: 2});
`;
    //number formatting
    for (i = 0; i < unit_types[identifiers[0]].length + identifiers[1][0].length; i++)
    {
        var j = i + 1;
        script_text = script_text + "\t\t\tformatNumer.format(data, " + j + ");\n";
    }
    //add options general part
    script_text = script_text + `
			var chart = new google.visualization.ComboChart(document.getElementById(\'combo` + count + `\'));
			var options = {
				chart: {subtitle: '[` + identifiers[0] + `]'},
				interpolateNulls: false,
				areaOpacity: 0,
				legend: {position: 'top'},
				hAxis: {title: "Date", format: "dd-MMM hh:mm"},
				seriesType: 'line',
				series: {`;
    //add special options for the actuators: type:area
    for (i = 0; i < identifiers[1][0].length; i++)
    {
        script_text = script_text + (i + unit_types[identifiers[0]].length) + ": {type: 'area', areaOpacity: 0.2}";
        if (i < identifiers[1][0].length - 1) {
            script_text = script_text + ", ";
        }
    }
    script_text = script_text + "},\n";
    //end
    script_text = script_text + `
			};
			chart.draw(data, options);
		};
		`;
    return script_text;
}

//load database
function load_database(filepath)
{
    console.log("Reading DB " + db_name);
    //read in the whole db file
    var filebuffer = fs.readFileSync(filepath);
    max_date = new Date(0);
    min_date = new Date();
    entities = [];
    unit_types = {};
    var db = new SQL.Database(filebuffer);
    //get every data from it
    var stmt = db.prepare('SELECT DISTINCT entity_id FROM states');
    stmt.getAsObject();
    var changes = db.prepare('SELECT last_changed FROM states');
    changes.getAsObject();

    //check if the from->to dates makes sense
    while (changes.step())
    {
        a_datestr = JSON.parse(JSON.stringify(changes.getAsObject()));
        a_date = new Date(a_datestr.last_changed);
        if (a_date < min_date) {
            min_date = a_date;
        }
        if (a_date > max_date) {
            max_date = a_date;
        }
    }
    console.log("Min_date=" + min_date);
    console.log("Max_date=" + max_date);

    // Bind new values
    while (stmt.step())
    {
        var row = stmt.getAsObject();
        var strrow = JSON.stringify(row);
        var entity = JSON.parse(strrow);
        //get entity id, and go through on it
        var example_entity = db.prepare('SELECT entity_id, attributes FROM states WHERE entity_id=:anentity LIMIT 1');
        example_entity.getAsObject({':anentity': entity.entity_id});
        entity = JSON.parse(JSON.stringify(example_entity.getAsObject()));
        var attributes = JSON.parse(entity.attributes);
        //get the unit of measurment, if exists
        if (attributes.hasOwnProperty("unit_of_measurement"))
        {
            entity.unit = attributes.unit_of_measurement;
            //and add the entity to the list
            if (entity.unit in unit_types)
            {
                unit_types[entity.unit].push(entity.entity_id);

            } else
            {
                unit_types[entity.unit] = [entity.entity_id];
            }
        }
        //or say it is a text entity
        else
        {
            entity.unit = "text";
        }
        delete entity.attributes;

        //get the entity data
        var entity_data = db.prepare('SELECT state, last_changed FROM states WHERE entity_id=:anentity');
        entity_data.getAsObject({':anentity': entity.entity_id});
        var datastream = [];
        //step through the netity data
        while (entity_data.step())
        {
            //and create variables for the current measurement data
            var adata = JSON.parse(JSON.stringify(entity_data.getAsObject()));
            var datapair = [adata.state, new Date(adata.last_changed)];
            //add it to a list
            datastream.push(datapair);
        }
        //and add the collected measurmeent data to the entity
        entity.data = datastream;
        //add the entity to the entities object collection
        entities.push(entity);
    }

    //finally count text_type entites
    text_type = 0;
    for (var key in entities)
    {
        var a_entity = entities[key];

        if (a_entity.unit === "text")
        {
            text_type = text_type + 1;
        }
    }
    text_timeline = text_timeline + "]";
    console.log("DB " + db_name + " read");
}
