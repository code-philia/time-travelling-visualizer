import time
import csv

def add_line(path, data_row):
    """
    data_row: list, [API_name, username, time]
    """
    now_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
    data_row.append(now_time)
    with open(path, "a+") as f:
        csv_write = csv.writer(f)
        csv_write.write_row(data_row)