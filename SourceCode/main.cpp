#include <iostream>

#include "ScriptLayerManager/PythonAPI.h"

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

	while (true)
	{
		pythonManager.runPythonScript();
	}

	return 0;
}