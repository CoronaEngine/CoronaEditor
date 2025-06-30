
class CabbageEngine():

    class Scene():
        def __init__(self,winID=None,lightField=None):
            self.winID = winID
            self.lightField = lightField
            return
        def setDisplaySurface(self,winId):
            print("CabbageEngine.setDisplaySurface")
            return True
        def setCamera(self,position, forward, worldup, fov):
            print("CabbageEngine.setCamera")
            return True        
        def setSunDirection(self,direction):
            print("CabbageEngine.setSunDirection")
            return True
    
    class Actor():
        def __init__(self,scene,path=None):
            self.path = path
            return
        def move(self,position):
            print("CabbageEngine.moveActor")
            return True
        def rotate(self,rotate):
            print("CabbageEngine.rotateActor")
            return True
        def scale(self,scale):
            print("CabbageEngine.scaleActor")
            return True