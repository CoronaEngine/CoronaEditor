class CoronaEngine():

    class Scene():
        def __init__(self,winID=None,lightField=None):
            self.winID = winID
            self.lightField = lightField
            return
        def setDisplaySurface(self,winId):
            print("CoronaEngine.setDisplaySurface")
            return True
        def setCamera(self,position, forward, worldup, fov):
            print("CoronaEngine.setCamera")
            return True        
        def setSunDirection(self,direction):
            print("CoronaEngine.setSunDirection")
            return True
    
    class Actor():
        def __init__(self,scene,path=None):
            self.path = path
            return
        def move(self,position):
            print("CoronaEngine.moveActor")
            return True
        def rotate(self,rotate):
            print("CoronaEngine.rotateActor")
            return True
        def scale(self,scale):
            print("CoronaEngine.scaleActor")
            return True