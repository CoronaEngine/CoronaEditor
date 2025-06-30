#include <iostream>

#include "CabbageEditor/PythonAPI.h"


int main()
{
    PythonAPI pythonManager;
    std::thread([&]() {
        while (true)
        {
            pythonManager.checkPythonScriptChange();
            pythonManager.checkReleaseScriptChange();
            std::this_thread::sleep_for(std::chrono::milliseconds(500));
        }
    }).detach();

    EngineOperateList engineCmdList;

    std::mutex mtx;

    std::thread([&]() {
        while (true)
        {
            pythonManager.runPythonScript();

            mtx.lock();
            engineCmdList.mergeOperate(CabbageEngine::pythonOperateList);
            mtx.unlock();
        }
    }).detach();

    while (true)
    {
    }

    return 0;
}