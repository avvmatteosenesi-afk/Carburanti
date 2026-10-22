from PIL import Image, ImageDraw

GREEN = '#00a63c'
WHITE = '#ffffff'

def icon(size):
    im = Image.new('RGB', (size, size), WHITE)
    d = ImageDraw.Draw(im)
    s = size / 512
    def box(coords, radius, fill):
        d.rounded_rectangle(tuple(int(v*s) for v in coords), radius=int(radius*s), fill=fill)
    box((106,92,350,418),36,GREEN)
    box((74,390,382,432),16,GREEN)
    box((142,128,314,244),22,WHITE)
    # hose
    pts=[(348,220),(384,220),(412,245),(412,285),(412,357),(420,402),(446,402),(482,384),(482,353),(482,241)]
    d.line([(int(x*s),int(y*s)) for x,y in pts], fill=GREEN, width=max(8,int(30*s)), joint='curve')
    # nozzle
    d.polygon([(int(x*s),int(y*s)) for x,y in [(436,128),(402,176),(432,198),(466,150)]], fill=GREEN)
    d.line([(int(431*s),int(181*s)),(int(462*s),int(204*s)),(int(462*s),int(282*s))], fill=GREEN, width=max(8,int(30*s)), joint='curve')
    return im

for size, name in [(192,'icon-192.png'),(512,'icon-512.png'),(180,'apple-touch-icon.png')]:
    icon(size).save(name, 'PNG', optimize=True)
