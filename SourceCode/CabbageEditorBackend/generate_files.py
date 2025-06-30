import os

def generate_binary_tree_files(depth, root_name="root", module_prefix="module_"):
    """
    生成完全二叉树结构的 Python 文件，每个节点导入其父节点
    
    参数:
        depth: 树的深度
        root_name: 根节点文件名(不带.py)
        module_prefix: 模块文件名前缀
    """
    # 创建根节点文件
    root_content = """def root_function():
    print("This is the root function from {}")
""".format(root_name)
    with open(f"{root_name}.py", "w") as f:
        f.write(root_content)
    
    # 计算节点总数和叶节点数量
    total_nodes = 2 ** depth - 1
    leaf_start_index = 2 ** (depth - 1) - 1
    
    # 生成所有子模块文件
    for i in range(1, total_nodes):
        module_name = f"{module_prefix}{i}"
        parent_index = (i - 1) // 2
        
        # 确定父模块名称
        if parent_index == 0:
            parent_module = root_name
        else:
            parent_module = f"{module_prefix}{parent_index}"
        
        # 根据是否为叶节点生成不同内容
        if i >= leaf_start_index:
            content = f"""import {parent_module}

print("This is leaf function from {module_name}")
"""
        else:
            content = f"""import {parent_module}
print("This is internal node function from {module_name}")
"""
        
        with open(f"{module_name}.py", "w") as f:
            f.write(content)
    
    # 生成main.py文件
    leaf_modules = [f"{module_prefix}{i}" for i in range(leaf_start_index, total_nodes)]
    
    main_content = "# main.py - imports all leaf nodes\n"
    for module in leaf_modules:
        main_content += f"import {module}\n"
    
    main_content += """
def run(isReload):
    if isReload:
        print("hot reload")
    
"""
      
    with open("./main.py", "w") as f:
        f.write(main_content)
    
    print(f"成功生成完全二叉树结构的文件系统：")
    print(f"- 树深度: {depth}")
    print(f"- 总模块数: {total_nodes}")
    print(f"- 叶节点数: {len(leaf_modules)}")
    print(f"- 根节点: {root_name}.py")
    print(f"- 叶节点范围: {module_prefix}{leaf_start_index} 到 {module_prefix}{total_nodes-1}")
    print(f"- 已生成 main.py，导入所有叶节点")

if __name__ == "__main__":
    # 设置树的深度（例如深度为3的树有7个节点）
    DEPTH = 3
    generate_binary_tree_files(DEPTH)