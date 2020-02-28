import sqlite3
import sys

##---------- Drop teble-------------------
# # Get connections to the databases
# db_a = sqlite3.connect('home-assistant_v2_20200107.db')
# a_cursor = db_a.cursor()

# dropTableStatemenet= "DROP TABLE events"
# a_cursor.execute(dropTableStatemenet)

# dropTableStatemenet= "DROP TABLE recorder_runs"
# a_cursor.execute(dropTableStatemenet)

# dropTableStatemenet= "DROP TABLE schema_changes"
# a_cursor.execute(dropTableStatemenet)

# db_a.execute("VACUUM")
# db_a.close
##---------- Drop teble-------------------


db_a = sqlite3.connect(sys.argv[1])
db_b = sqlite3.connect(sys.argv[2])

a_cursor = db_a.cursor()
# print(a_cursor.execute("tables"))

# Get the contents of a table
b_cursor = db_b.cursor()
b_cursor.execute('SELECT * FROM states')
output = b_cursor.fetchall()  # Returns the results as a list.

# Insert those contents into another table.
ret=a_cursor.execute('SELECT MAX(state_id) FROM states');
unique_id=a_cursor.fetchall()
if None in unique_id[0]:
    unique_id=0
else:
    unique_id=int(list(unique_id[0])[0])
print("Existing database max state_id: ", unique_id)
num_added=0
num_duplicate=0
num_skipped=0
for row in output:
    unique_id=unique_id+1
    row= row[:10] + ('',)
    row=(unique_id,) + row[1:]
    #print(row)
    awhere=(row[2],) + (row[3],)+(row[6],) + (row[7],)
    #print(awhere)
    a_cursor.execute('SELECT state_id FROM states WHERE entity_id=? AND state=? AND last_changed=? AND last_updated=?',awhere);
    isunique=a_cursor.fetchone()
    #print(isunique)
    if None is isunique:
        # WHERE last_changed=last_updated
        if row[6]==row[7]:
            my_command = 'INSERT INTO states (state_id, domain, entity_id, state, attributes, event_id, last_changed, last_updated, created, context_id, context_user_id) VALUES ' + str(row)
            #print(my_command)
            a_cursor.execute(my_command)
            #print(unique_id, " unique element found, added.")
            num_added = num_added+1
        else:
            num_skipped=num_skipped+1
            unique_id=unique_id-1
    else:
        #print("Non unique element found, not added.")
        unique_id=unique_id-1
        num_duplicate=num_duplicate+1
print(num_added, " element added to the database, ", num_duplicate, " element was existing already and ", num_skipped, " elements were not state-changes.")

# Cleanup
db_a.commit()
db_a.execute("VACUUM")
a_cursor.close()
b_cursor.close()
db_a.close
db_b.close

#SELECT state_id, domain, entity_id, state, attributes, event_id, last_changed, last_updated, created, context_id, context_user_id from states;
