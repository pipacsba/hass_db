#!/usr/bin/python
# from BaseHTTPServer import BaseHTTPRequestHandler,HTTPServer
from http.server import HTTPServer, BaseHTTPRequestHandler
from os import curdir, sep, listdir, path
import sqlite3
from datetime import date, datetime, timezone
import json
import ssl
import base64
import zlib


PORT_NUMBER = 3000

# where are the db files stored on the srver?
filelist = []
# db_path="Y:\\hass"
db_path = "./"
# db_path = "/mnt/movies/hass"
db_name = ""
prev_db_name = ""

# define input for combo chart (currently only 1 is supported)
c_unit = "\\u00b0C"
c_added_text_entities = [["sensor.hitachi_relay", "sensor.netatmo_relay"],
                         ["sensor.cooling_target_temp", "sensor.heating_target_temp"]]
c_actuator_summary = []

# some overall variables
entities = []
max_date = datetime.combine(date.min, datetime.min.time())
min_date = datetime.combine(date.max, datetime.min.time())
unit_types = {}
text_type = 0


# gzip compatible zlib encode
def zlib_encode(content):
    zlib_compress = zlib.compressobj(9, zlib.DEFLATED, zlib.MAX_WBITS | 16)
    data = zlib_compress.compress(content) + zlib_compress.flush()
    return data


def load_database(filepath):
    global entities, min_date, max_date, unit_types, text_type
    # print("Reading DB " + db_name);
    # read in the whole db file
    max_date = datetime.combine(date.min, datetime.min.time())
    min_date = datetime.combine(date.max, datetime.min.time())
    entities = []
    unit_types = {}
    try:
        db = sqlite3.connect(filepath)
        # get every data from it
        cursor = db.cursor()
        cursor.execute('SELECT * FROM states')
        output = cursor.fetchall()  # Returns the results as a list.
        for row in output:
            entity_id = row[2]
            state = row[3]
            attributes = json.loads(row[4])
            stat_time = datetime.strptime(row[6], "%Y-%m-%d %H:%M:%S.%f")
            # check min and max dates
            if min_date > stat_time:
                min_date = stat_time
            if max_date < stat_time:
                max_date = stat_time
            # check if entity exists already
            existing_id = None
            for i in range(len(entities)):
                if entities[i]['entity_id'] == entity_id:
                    existing_id = i
            if existing_id is not None:
                entities[existing_id]['data'].append([state, stat_time.replace(tzinfo=timezone.utc).astimezone().isoformat()])
            else:
                # fill the entity object
                anentity = {
                    'entity_id': entity_id,
                    'data': [],
                    'unit': ""
                }
                # if unit is known
                if "unit_of_measurement" in attributes:
                    anentity['unit'] = attributes["unit_of_measurement"]
                    # fill the list of "unit used by"
                    if attributes["unit_of_measurement"] in unit_types:
                        unit_types[attributes["unit_of_measurement"]].append(entity_id)
                    else:
                        unit_types[attributes["unit_of_measurement"]] = []
                        unit_types[attributes["unit_of_measurement"]].append(entity_id)
                # unit is "text" calculate how many of it we have
                else:
                    anentity['unit'] = "text"
                    text_type = text_type + 1
                # create data pairs of state and date
                anentity['data'].append([state, stat_time.replace(tzinfo=timezone.utc).astimezone().isoformat()])
                # fill entity into entities
                entities.append(anentity)
        db.close();

    except:
        entities=[]
    # print("DB contains data from " + str(min_date) + " to " + str(max_date))
    # print(unit_types)


# This class will handles any incoming request from
# the browser
class MyHandler(BaseHTTPRequestHandler):

    def log_message(self, a_format, *args):
        return

    # Handler for the GET requests
    def do_GET(self):
        global db_name, prev_db_name, filelist, entities
        # get Database query
        prev_db_name = db_name
        path_arr = self.path.split("?")
        if len(path_arr) > 1:
            query_arr = path_arr[1].split("&")
            for a_query in query_arr:
                a_pair = a_query.split("=")
                if a_pair[0] == "Database":
                    db_name = a_pair[1]
        self.path = path_arr[0]

        # get list of db
        filelist = []
        for file in listdir(db_path):
            if file.endswith(".db"):
                size = path.getsize(path.join(db_path, file)) >> 20
                filelist.append(file + "," + str(size) + "MB")

        if self.path == "/":
            self.path = "/index.html"

        try:
            # base html
            if self.path.endswith(".html"):
                mimetype = 'text/html'
                # load the database
                # checking if database name changed is removed to enable re-load of the database
                if db_name != "":
                    if path.isfile(db_path + sep + db_name):
                        load_database(db_path + sep + db_name)
                    else:
                        db_name = ""
                        entities = []
                # Open the static file requested and send it
                f = open(curdir + sep + self.path, 'rb')
                self.send_response(200)
                self.send_header('Content-type', mimetype)
                self.end_headers()
                self.wfile.write(f.read())
                f.close()

            # db list for drop-down
            elif self.path.endswith("db_list"):
                # print("db_list requested")
                mimetype = 'text/html'
                self.send_response(200)
                self.send_header('Content-type', mimetype)
                self.end_headers()
                self.wfile.write(json.dumps(filelist).encode('utf-8'))

            # send the database
            elif self.path.endswith("get_db"):
                mimetype = 'text/html'
                self.send_response(200)
                self.send_header('Content-type', mimetype)
                self.send_header("Content-Encoding", "gzip")
                self.end_headers()
                # prepare data to send
                db = {
                    'entities': entities,
                    'max_date': max_date.isoformat(),
                    'min_date': min_date.isoformat(),
                    'unit_types': unit_types,
                    'text_type': text_type,
                    'db_name': db_name,
                    'c_unit': c_unit,
                    'c_added_text_entities': c_added_text_entities
                }
                data = json.dumps(db).encode('utf-8')
                data = zlib_encode(data)
                self.wfile.write(data)

            # if none of the above, than send not found reply
            else:
                self.send_error(404, 'File Not Found: %s' % self.path)

            return

        # in case of error send not found
        except IOError:
            self.send_error(404, 'File Not Found: %s' % self.path)


class SimpleHTTPAuthHandler(BaseHTTPRequestHandler):
    """Main class to present webpages and authentication."""
    
    def log_message(self, a_format, *args):
        return

    def do_HEAD(self):
        # head method
        self.send_response(200)
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_authhead(self):
        global db_name, entities
        db_name = ""
        entities = []
        # do authentication '''
        self.send_response(401)
        self.send_header('WWW-Authenticate', 'Basic realm=\"Test\"')
        self.send_header('Content-type', 'text/html')
        self.end_headers()

    def do_GET(self):
        # Present front page with user authentication.
        auth_header = self.headers.get('Authorization', '').encode('ascii')
        if auth_header is None:
            self.do_authhead()
            self.wfile.write(b'no auth header received')
        elif auth_header == b'Basic ' + self.KEY:
            MyHandler.do_GET(self)
        else:
            self.do_authhead()
            self.wfile.write(auth_header)
            self.wfile.write(b'not authenticated')
            

# Create a web server and define the handler to manage the
# incoming request
server = HTTPServer(('', PORT_NUMBER), SimpleHTTPAuthHandler)
cert = './fullchain.pem'
key = './privkey.pem'
SimpleHTTPAuthHandler.KEY = base64.b64encode(b"user:password")
server.socket = ssl.wrap_socket(server.socket, certfile=cert, keyfile=key, server_side=True)
print('Started httpserver on port ', PORT_NUMBER)

try:
    # Wait forever for incoming htto requests
    server.serve_forever()

except KeyboardInterrupt:
    print('^C received, shutting down the web server')
    server.socket.close()
