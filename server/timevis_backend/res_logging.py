import xlwt
import csv

def add_line(path, data_row):
    """
    data_row: list, [API_name, username, time]
    """
    now_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
    data_row.append(now_time)
    with open(path, "a+") as f:
        csv_write = csv.writer(f)
        csv_write.write_row(line)

def write_txt(path, API_name, username):
    # path = "/Users/zhangyifan//DVI/SingleVisualization/server/"
    now_time = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime())
    with open(path+"API_result.csv","a") as file:
        file.write(now_time+" | "+ API_name + "|"+"\n")

def write_xls(path):
    # path = "/Users/zhangyifan/project/DVI/SingleVisualization/server/"
    workbook = xlwt.Workbook(encoding="utf-8")
    sheet = workbook.add_sheet("Sheet1")

    row = 0
    with open(path+"API_result.txt") as  filetxt:
     for line in filetxt:
        line = line.strip()
        fileds = line.split(" ")
        for col, value in enumerate(fileds):
           sheet.write(row, col, value)
        row += 1
    workbook.save(path+"API_result.xls")