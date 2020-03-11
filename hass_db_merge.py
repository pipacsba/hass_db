import sqlite3
import sys
import datetime
import os

#day of month to switch to new database
change_day = 1
c_added_text_entities = [["sensor.hitachi_relay", "sensor.netatmo_relay"],
                         ["sensor.cooling_target_temp", "sensor.heating_target_temp"]]

file_to = sys.argv[1]
file_from= sys.argv[2]
file_schema = sys.argv[3]

files_ready = False

steps_ready=0;

if (datetime.datetime.now().day == change_day):
	print("Change database")

	# first get last values from file_to
	if steps_ready == 0:
		db_to = sqlite3.connect(file_to)
		to_cursor= db_to.cursor()
		#flatten the input data
		x_flat = (item for row in c_added_text_entities for item in row)
		# for each entity
		saved = {}
		for entity in x_flat:
			awhere=(entity,)
			ret = to_cursor.execute('SELECT * from states WHERE entity_id=? ORDER BY state_id DESC LIMIT 1', awhere)
			entity_state = to_cursor.fetchall()
			saved[entity] = entity_state[0]
		to_cursor.close()
		db_to.close()
		steps_ready = 1
	
	# move the old file to a new file
	if steps_ready == 1:
		yesterday = datetime.datetime.strftime(datetime.datetime.now() - datetime.timedelta(days=1), '%Y_%m')
		os.rename(file_to, "hass_" + yesterday + ".db")
		steps_ready = 2
	
	#copy the template to hass.db
	if steps_ready == 2:
		os.system('cp '+ file_schema + ' ' + file_to)
		steps_ready = 3
		
	# get the first date from the file_from DB
	if steps_ready == 3:
		db_from = sqlite3.connect(file_from)
		from_cursor = db_from.cursor()
		ret = from_cursor.execute('SELECT last_changed from states ORDER BY state_id ASC LIMIT 10')
		times = from_cursor.fetchall()
		min_time=datetime.datetime.now()
		for atime_str in times:
			atime = datetime.datetime.strptime(atime_str[0], "%Y-%m-%d %H:%M:%S.%f")
			if (atime < min_time):
				min_time = atime
				min_time_str = min_time.strftime("%Y-%m-%d %H:%M:%S.%f")
		from_cursor.close()
		db_from.close()
		steps_ready = 4
	
	# add saved entities to new db
	if steps_ready == 4:
		db_to = sqlite3.connect(file_to)
		to_cursor = db_to.cursor()
		unique_id = 0
		for entity in saved:
			unique_id = unique_id + 1
			row = saved[entity]
			row = row[:10] + ('',)
			row = (unique_id,) + row[1:]
			row = row[:6] + (min_time_str,) + (min_time_str,) + (min_time_str,) + row[9:]
			# sometimes the \\ is duplicated
			row = row[:4] + (str(row[4]).replace("\\\\","\\"),) + row[5:]
			my_command = 'INSERT INTO states (state_id, domain, entity_id, state, attributes, event_id, last_changed, last_updated, created, context_id, context_user_id) VALUES ' + str(row)
			to_cursor.execute(my_command)
		db_to.commit()
		to_cursor.close()
		db_to.close()
		steps_ready = 5
		
	if steps_ready == 5:
		files_ready = True
	
else:
	files_ready = True

if files_ready:
	db_a = sqlite3.connect(file_to)
	db_b = sqlite3.connect(file_from)

	a_cursor = db_a.cursor()
	# print(a_cursor.execute("tables"))

	# Get the contents of a table
	b_cursor = db_b.cursor()
	b_cursor.execute('SELECT * FROM states')
	output = b_cursor.fetchall()  # Returns the results as a list.

	# Insert those contents into another table.
	ret = a_cursor.execute('SELECT MAX(state_id) FROM states');
	unique_id=a_cursor.fetchall()
	if None in unique_id[0]:
		unique_id = 0
	else:
		unique_id = int(list(unique_id[0])[0])
	print("Existing database max state_id: ", unique_id)
	num_added = 0
	num_duplicate = 0
	num_skipped = 0
	for row in output:
		unique_id = unique_id + 1
		row = row[:10] + ('',)
		row =(unique_id,) + row[1:]
		# sometimes the \\ is duplicated
		row = row[:4] + (str(row[4]).replace("\\\\","\\"),) + row[5:]
		#print(row)
		awhere =(row[2],) + (row[3],)+(row[6],) + (row[7],)
		#print(awhere)
		a_cursor.execute('SELECT state_id FROM states WHERE entity_id=? AND state=? AND last_changed=? AND last_updated=?',awhere);
		isunique = a_cursor.fetchone()
		#print(isunique)
		if None is isunique:
			# WHERE last_changed=last_updated
			if row[6] == row[7]:
				my_command = 'INSERT INTO states (state_id, domain, entity_id, state, attributes, event_id, last_changed, last_updated, created, context_id, context_user_id) VALUES ' + str(row)
				#print(my_command)
				a_cursor.execute(my_command)
				#print(unique_id, " unique element found, added.")
				num_added = num_added+1
			else:
				num_skipped = num_skipped+1
				unique_id = unique_id-1
		else:
			#print("Non unique element found, not added.")
			unique_id = unique_id-1
			num_duplicate = num_duplicate+1
	print(num_added, " element added to the database, ", num_duplicate, " element was existing already and ", num_skipped, " elements were not state-changes.")

	# Cleanup
	db_a.commit()
	db_a.execute("VACUUM")
	a_cursor.close()
	b_cursor.close()
	db_a.close()
	db_b.close()

	#SELECT state_id, domain, entity_id, state, attributes, event_id, last_changed, last_updated, created, context_id, context_user_id from states;
