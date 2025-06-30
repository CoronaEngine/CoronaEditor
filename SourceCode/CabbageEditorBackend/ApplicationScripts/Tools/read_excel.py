import logging
import os.path

import pandas as pd

from Tools.settings import table_path


def read_excel(excel_path, sheet_name):
    try:
        if sheet_name:
            df = pd.read_excel(excel_path, sheet_name=sheet_name)
        else:
            df = pd.read_excel(excel_path, sheet_name=0)
        row_num = len(df.index.values)
        col_num = len(df.columns.values)

        excel_result = []
        for line in range(3, row_num):
            line_dict = {}
            for col in range(0, col_num):
                line_dict[df.loc[1].values[col]] = df.loc[line].values[col]
            excel_result.append(line_dict)
        return excel_result
    except Exception as e:
        logging.error(str(e))
        return []


def generate_excel(cls):
    members = []

    expect_variable = ['static_variable_list', 'dynamic_variable_list']

    final_dict = {}
    # 遍历整个继承链
    for base in reversed(cls.__mro__):  # 从基类到子类
        # 解析__init__参数
        attr_dict = vars(base)
        attr_list = [k for k, v in attr_dict.items() if
                     not k.startswith('_') and not callable(v) and k not in expect_variable and not k.endswith('_ogn')]
        for attr in attr_list:
            final_dict[attr] = type(getattr(cls, f"_{attr}")).__name__

    print(final_dict)

    df = pd.DataFrame()

    excel_writer = pd.ExcelWriter(
        os.path.join(table_path, f"{cls.__name__}.xlsx"),
        engine='xlsxwriter',
        date_format='YYYY-MM-DD'
    )

    df.to_excel(
        excel_writer,
        sheet_name='default',
        index=False,
        header=False,
        startrow=0
    )

    # 添加格式（需要xlsxwriter）
    workbook = excel_writer.book
    worksheet = excel_writer.sheets['default']
    header_format = workbook.add_format({
        'bold': True,
        'font_name': '等线'
    })
    # 写入标题
    for col_num, value in enumerate(final_dict):
        worksheet.write(2, col_num, value, header_format)
        worksheet.write(3, col_num, final_dict.get(value), header_format)

    worksheet.set_column(0, len(df.columns) - 1, 10)
    excel_writer.close()
    return members

