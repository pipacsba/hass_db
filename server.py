#!/usr/bin/python
#from BaseHTTPServer import BaseHTTPRequestHandler,HTTPServer
from http.server import BaseHTTPRequestHandler,HTTPServer
from os import curdir, sep, listdir, path
import sqlite3
from datetime import date, datetime, timezone
import json

PORT_NUMBER = 3000

#where are the db files stored on the srver?
filelist = []
#db_path="Y:\\hass"
db_path = "C:\\cygwin64\\home\\agoston.lorincz\\hass_db"
db_name = ""
prev_db_name = ""

#define input for combo chart (currently only 1 is supported)
c_unit = "\\u00b0C"
c_added_text_entities = [["sensor.hitachi_relay", "sensor.netatmo_relay"], ["sensor.cooling_target_temp", "sensor.heating_target_temp"]]
c_actuator_summary = []

#some overall variables
entities = []
max_date = datetime.combine(date.min, datetime.min.time())
min_date = datetime.combine(date.max, datetime.min.time())
unit_types = {}
text_type = 0

def load_database(filepath):
	global entities, min_date, max_date, unit_types, text_type
	print("Reading DB " + db_name);
	# read in the whole db file
	max_date = datetime.combine(date.min, datetime.min.time())
	min_date = datetime.combine(date.max, datetime.min.time())
	entities = []
	unit_types = {}
	db = sqlite3.connect(filepath)
	# get every data from it
	cursor = db.cursor()
	cursor.execute('SELECT * FROM states')
	output = cursor.fetchall()  # Returns the results as a list.
	for row in output:
		entity_id  = row[2]
		state      = row[3]
		attributes = json.loads(row[4])
		stat_time  = datetime.strptime(row[6], "%Y-%m-%d %H:%M:%S.%f")
		if (min_date > stat_time):
			min_date = stat_time
		if (max_date < stat_time):
			max_date = stat_time
		#check if entity exists already
		existing_id= None
		for i in range(len(entities)):
			if (entities[i]['entity_id']== entity_id):
				existing_id=i
		if existing_id != None:
			entities[existing_id]['data'].append([state, stat_time.replace(tzinfo=timezone.utc).astimezone().isoformat()])
		else:
			# print(attributes)
			anentity={}
			anentity['entity_id']=entity_id
			anentity['data']=[]
			anentity['unit']=""
			if "unit_of_measurement" in attributes:
				# print("unit of measurement found")
				anentity['unit']=attributes["unit_of_measurement"]
				if attributes["unit_of_measurement"] in unit_types:
					unit_types[attributes["unit_of_measurement"]].append(entity_id)
				else:
					unit_types[attributes["unit_of_measurement"]]=[]
					unit_types[attributes["unit_of_measurement"]].append(entity_id)
			else:
				anentity['unit']="text"
				text_type = text_type + 1
			anentity['data'].append([state, stat_time.replace(tzinfo=timezone.utc).astimezone().isoformat()])
			entities.append(anentity)
	print("DB contains data from " + str(min_date) + " to " + str(max_date))
	# print(unit_types)



#This class will handles any incoming request from
#the browser 
class myHandler(BaseHTTPRequestHandler):
	
	#Handler for the GET requests
	def do_GET(self):
		global db_name, prev_db_name, filelist
		#get Database query
		prev_db_name = db_name
		path_arr=self.path.split("?")
		if (len(path_arr) > 1):
			query_arr=path_arr[1].split("&")
			for a_query in query_arr:
				a_pair=a_query.split("=")
				if a_pair[0]== "Database":
					db_name=a_pair[1]
		self.path=path_arr[0]
		
		#get list of db
		filelist=[]
		for file in listdir(db_path):
			if file.endswith(".db"):
				size=path.getsize(path.join(db_path, file)) >> 20
				filelist.append(file + "," + str(size) + "MB")


		if self.path=="/":
			self.path="/index.html"

		try:
			#Check the file extension required and
			#set the right mime type

			sendReply = False
			#print(self.path)
			if self.path.endswith(".html"):
				mimetype='text/html'
				sendReply = True
				
				if (db_name != prev_db_name):
					load_database(db_path + "\\" + db_name)	
				#Open the static file requested and send it
				f = open(curdir + sep + self.path, 'rb') 
				self.send_response(200)
				self.send_header('Content-type',mimetype)
				self.end_headers()
				self.wfile.write(f.read())
				f.close()
				
			if self.path.endswith("db_list"):
				print("db_list requested")
				mimetype='text/html'
				sendReply = True
				self.send_response(200)
				self.send_header('Content-type',mimetype)
				self.end_headers()
				self.wfile.write(json.dumps(filelist).encode('utf-8'))
				

			if self.path.endswith("get_db"):
				mimetype='text/html'
				sendReply = True
				self.send_response(200)
				self.send_header('Content-type',mimetype)
				self.end_headers()
				
				db = {};
				db['entities'] = entities;
				db['max_date'] = max_date.isoformat();
				db['min_date'] = min_date.isoformat();
				db['unit_types'] = unit_types;
				db['text_type'] = text_type;
				db['db_name']=db_name;
				db['c_unit']=c_unit;
				db['c_added_text_entities']=c_added_text_entities;
				
				self.wfile.write(json.dumps(db).encode('utf-8'))
			
			return


		except IOError:
			self.send_error(404,'File Not Found: %s' % self.path)

try:
	#Create a web server and define the handler to manage the
	#incoming request
	
	server = HTTPServer(('', PORT_NUMBER), myHandler)
	print('Started httpserver on port ' , PORT_NUMBER)
	
	#Wait forever for incoming htto requests
	server.serve_forever()

except KeyboardInterrupt:
	print('^C received, shutting down the web server')
	server.socket.close()
