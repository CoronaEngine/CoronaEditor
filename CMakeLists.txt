# ===============================================================================
# CabbageEditor 项目主 CMake 配置文件
# ===============================================================================
# 该文件负责项目的全局配置、依赖查找、源文件管理、编译/链接选项、平台适配等。
# ===============================================================================

# ----------------------------- 基础配置 ----------------------------------------
# 设置 CMake 最低版本要求
cmake_minimum_required(VERSION 4.0)
set(CMAKE_POLICY_VERSION_MINIMUM "4.0")

# ----------------------------- 项目信息 ----------------------------------------
# 定义项目名称、版本、主页及支持的语言
project(
    CabbageEditor
    VERSION 0.5.0
    HOMEPAGE_URL "https://github.com/CoronaEngine/CabbageEditor"
    LANGUAGES C CXX
)

# ----------------------------- 预设检查 ----------------------------------------
if(NOT USED_PRESET_CONFIG)
    message(FATAL_ERROR "错误: 必须使用 CMake 预设配置 (USED_PRESET_CONFIG)！")
endif()

# 判断当前目录是否为项目根目录
set(IS_ROOT_DIR TRUE)

if(NOT ${CMAKE_SOURCE_DIR} STREQUAL ${CMAKE_CURRENT_SOURCE_DIR})
    set(IS_ROOT_DIR FALSE)
    message(STATUS "[CabbageEditor] 当前目录不是项目根目录，设置 IS_ROOT_DIR 为 FALSE。")
endif()

if(IS_ROOT_DIR)
    message(STATUS "[CabbageEditor] 正在配置项目根目录: ${CMAKE_CURRENT_SOURCE_DIR}")
else()
    message(STATUS "[CabbageEditor] 正在配置子目录: ${CMAKE_CURRENT_SOURCE_DIR}")
endif()

# ----------------------------- 策略配置 ----------------------------------------
if(POLICY CMP0077)
    cmake_policy(SET CMP0077 NEW) # 使 option() 命令作用于当前目录作用域
endif()

# ----------------------------- 依赖查找 ----------------------------------------
# 查找 Python 3.13，要求包含解释器和开发组件
find_package(Python3 3.13 REQUIRED COMPONENTS Interpreter Development)

# 查找 CUDA 工具链（可选）
find_package(CUDAToolkit)

# 自动安装 Python 依赖
execute_process(
    COMMAND "${Python3_EXECUTABLE}" "${CMAKE_CURRENT_SOURCE_DIR}/ExternalEnvironment/scripts/pip_install.py"
    WORKING_DIRECTORY "${CMAKE_CURRENT_SOURCE_DIR}/ExternalEnvironment/scripts"
    COMMAND_ECHO STDOUT
)

# ----------------------------- 源文件管理 --------------------------------------
# 文件分组函数（用于 IDE 文件夹分组）
function(set_source_groups SOURCE_FILES SOURCE_DIR SOURCE_DIR_NAME)
    foreach(each_source_file IN LISTS SOURCE_FILES)
        get_filename_component(each_source_path "${each_source_file}" PATH)
        file(RELATIVE_PATH each_source_path_rel ${SOURCE_DIR} ${each_source_path})

        # 若路径为空则归入根分组
        if("${each_source_path_rel}" STREQUAL "")
            source_group("${SOURCE_DIR_NAME}" FILES ${each_source_file})
            continue()
        endif()

        string(REPLACE "/" "\\" each_source_group_path ${each_source_path_rel})
        source_group("${SOURCE_DIR_NAME}/${each_source_group_path}"
            FILES ${each_source_file})
    endforeach()
endfunction()

# 设置源代码目录
set(SOURCE_DIR ${CMAKE_CURRENT_SOURCE_DIR}/SourceCode)

# 递归收集所有源文件
file(GLOB_RECURSE SOURCE_FILES CONFIGURE_DEPENDS "${SOURCE_DIR}/*.*")

# 配置需忽略的文件或文件夹
if(IS_ROOT_DIR)
    set(IGNORE_FILES
        "SourceCode/CabbageEditorBackend/*"
        "SourceCode/CabbageEditorFrontend/*"
    )
else()
    set(IGNORE_FILES
        "SourceCode/CabbageEditorBackend/*"
        "SourceCode/CabbageEditorFrontend/*"
        "SourceCode/main.cpp" # 非根目录时忽略主函数
    )
endif()

# 过滤掉需忽略的文件
foreach(file ${IGNORE_FILES})
    list(FILTER SOURCE_FILES EXCLUDE REGEX ${file})
endforeach()

# ----------------------------- 目标配置 ----------------------------------------
# 仅在根目录下添加主函数并生成可执行文件
if(IS_ROOT_DIR)
    add_executable(${PROJECT_NAME} ${SOURCE_FILES}) # 创建可执行目标
    set_source_groups("${SOURCE_FILES}" ${SOURCE_DIR} "SourceCode")

    # ------------------------- 编译器选项 --------------------------------------
    target_compile_options(${PROJECT_NAME} PRIVATE

        # RelWithDebInfo: 保留帧指针和调试符号
        $<$<AND:$<CONFIG:RelWithDebInfo>,$<NOT:$<CXX_COMPILER_ID:MSVC>>>:-fno-omit-frame-pointer>
        $<$<AND:$<CONFIG:RelWithDebInfo>,$<NOT:$<CXX_COMPILER_ID:MSVC>>>:-g>

        # MinSizeRel: 体积优化
        $<$<AND:$<CONFIG:MinSizeRel>,$<NOT:$<CXX_COMPILER_ID:MSVC>>>:-ffunction-sections>
        $<$<AND:$<CONFIG:MinSizeRel>,$<NOT:$<CXX_COMPILER_ID:MSVC>>>:-fdata-sections>
        $<$<AND:$<CONFIG:MinSizeRel>,$<CXX_COMPILER_ID:Clang>>:-Oz>
        $<$<AND:$<CONFIG:MinSizeRel>,$<CXX_COMPILER_ID:MSVC>>:/GL>

        # MSVC: 警告等级与编码
        $<$<CXX_COMPILER_ID:MSVC>:/W1>
        $<$<CXX_COMPILER_ID:MSVC>:/source-charset:utf-8>
        $<$<CXX_COMPILER_ID:MSVC>:/execution-charset:utf-8>
    )

    # ------------------------- 链接器选项 --------------------------------------
    target_link_options(${PROJECT_NAME} PRIVATE

        # MinSizeRel: 链接时体积优化
        $<$<AND:$<CONFIG:MinSizeRel>,$<PLATFORM_ID:Linux>,$<NOT:$<CXX_COMPILER_ID:MSVC>>>:LINKER:--gc-sections>
        $<$<AND:$<CONFIG:MinSizeRel>,$<PLATFORM_ID:Darwin>>:-dead_strip>
        $<$<AND:$<CONFIG:MinSizeRel>,$<CXX_COMPILER_ID:MSVC>>:/LTCG>
        $<$<AND:$<CONFIG:MinSizeRel>,$<CXX_COMPILER_ID:MSVC>>:/OPT:REF>
        $<$<AND:$<CONFIG:MinSizeRel>,$<CXX_COMPILER_ID:MSVC>>:/OPT:ICF>
    )

    # ------------------------- 预处理器定义 ------------------------------------
    target_compile_definitions(${PROJECT_NAME} PRIVATE

        # 配置相关宏定义
        $<$<CONFIG:RelWithDebInfo>:ENABLE_DETAILED_LOGGING=1>
        $<$<CONFIG:RelWithDebInfo>:CABBAGE_ENGINE_DEBUG>
        $<$<CONFIG:MinSizeRel>:DISABLE_EXTRA_FEATURES=1>
        $<$<CONFIG:MinSizeRel>:CABBAGE_ENGINE_RELEASE>

        # MSVC 特定定义
        $<$<CXX_COMPILER_ID:MSVC>:_CRT_SECURE_NO_WARNINGS>
        NOMINMAX
    )

    # ------------------------- 目标属性 ----------------------------------------
    set_target_properties(${PROJECT_NAME} PROPERTIES
        RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin/$<CONFIG>
        LIBRARY_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib/$<CONFIG>
        ARCHIVE_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/lib/$<CONFIG>
        PDB_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin/$<CONFIG>
        VS_DEBUGGER_WORKING_DIRECTORY $<TARGET_FILE_DIR:${PROJECT_NAME}>
    )

    # ------------------------- 全局属性 ----------------------------------------
    set_property(GLOBAL PROPERTY USE_FOLDERS ON) # 启用 IDE 文件夹
    set_property(DIRECTORY ${CMAKE_CURRENT_SOURCE_DIR} PROPERTY VS_STARTUP_PROJECT ${PROJECT_NAME})

    message(STATUS "[CabbageEditor] 已完成目标属性与全局属性配置。")

    # ------------------------- Windows 平台适配 --------------------------------
    if(WIN32)
        message(STATUS "[CabbageEditor] 检测到 Windows 平台，正在配置相关依赖与脚本。")
        target_include_directories(${PROJECT_NAME} PRIVATE
            "${Python3_INCLUDE_DIRS}"
            "${CMAKE_CURRENT_SOURCE_DIR}/SourceCode"
        )

        target_link_directories(${PROJECT_NAME} PRIVATE "${Python3_LIBRARY_DIRS}")
        target_link_libraries(${PROJECT_NAME} PRIVATE "${Python3_LIBRARIES}")

        # 构建后自动执行 npm 构建和资源同步脚本
        add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E echo "[CabbageEditor] 正在执行 npm_build.py ..."
            COMMAND ${Python3_EXECUTABLE} "${CMAKE_CURRENT_SOURCE_DIR}/ExternalEnvironment/scripts/npm_build.py"
            VERBATIM
        )
        add_custom_command(TARGET ${PROJECT_NAME} POST_BUILD
            COMMAND ${CMAKE_COMMAND} -E echo "[CabbageEditor] 正在执行 sync_res.py ..."
            COMMAND ${Python3_EXECUTABLE} "${CMAKE_CURRENT_SOURCE_DIR}/ExternalEnvironment/scripts/sync_res.py"
            "--python-root-dir" "${Python3_ROOT_DIR}"
            "--runtime-output_dir" "$<TARGET_FILE_DIR:${PROJECT_NAME}>"
            "--cmake-root-dir" "${CMAKE_CURRENT_SOURCE_DIR}"
            VERBATIM
        )
        message(STATUS "[CabbageEditor] Windows 平台依赖与脚本配置完成。")
    endif()

    message(STATUS "[CabbageEditor] 构建配置流程结束。")
endif()