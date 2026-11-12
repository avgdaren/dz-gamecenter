"""(C) 2026 Carinoasd. Versioned stage-rule tables: 小典 / Codex.

Optional authoring utility, standard library only. Runtime JS/PHP read the same
integer tables in rules.json; floating point is used only to author these tables.
"""
from pathlib import Path
import json
import math

ROOT = Path(__file__).resolve().parents[2]
RULES = ROOT / "source/plugin/gamecenter/games/_danmaku_proto/rules.json"


def main():
    rules = json.loads(RULES.read_text(encoding="utf-8"))
    design = json.loads((ROOT / "docs/danmaku/STAGE-01-DESIGN-v1.json").read_text(encoding="utf-8"))
    paths = []
    for kind, life in enumerate([300, 360, 720]):
        points = []
        for age in range(life + 1):
            a = age / 60
            if kind == 0:
                u = age / life
                v = 1 - u
                x = -24*v**3 + 3*80*v*v*u + 3*400*v*u*u + 504*u**3
                y = 56*v**3 + 3*220*v*v*u + 3*220*v*u*u + 56*u**3
            elif kind == 1:
                x = 0
                y = -32+152*a if a < 1 else 120 if a < 4.2 else 120-160*(a-4.2)/1.8
            else:
                x = 0 if a < 1.6 or a >= 10.4 else 40*math.sin((a-1.6)*math.pi/4.4)
                y = -48+180*a/1.6 if a < 1.6 else 132 if a < 10.4 else 132-180*(a-10.4)/1.6
            points.append([int(x*64), int(y*64)])
        paths.append(points)
    types = [
        {"name":"巡星妖精", "hp":32, "radius":8, "life":300, "speedQ":115, "bulletRadius":4, "ttl":300, "killScore":100,
         "attacks":[{"at":81,"warning":54,"aimed":False,"capture":False,"offsets":[-23,0,23]}]},
        {"name":"引光侍从", "hp":90, "radius":10, "life":360, "speedQ":122, "bulletRadius":4, "ttl":300, "killScore":200,
         "attacks":[{"at":96,"warning":60,"aimed":True,"capture":True,"offsets":[-14,0,14]},
                    {"at":120,"warning":60,"aimed":True,"capture":False,"offsets":[-14,0,14]}]},
        {"name":"星仪守卫", "hp":360, "radius":22, "life":720, "speedQ":109, "bulletRadius":5, "ttl":330, "killScore":1000,
         "attacks":[{"at":144,"warning":108,"aimed":True,"capture":True,"offsets":[-17,0,17]},
                    {"at":300,"warning":264,"aimed":False,"capture":False,"offsets":[-68,-51,-34,-17,0,17,34,51,68]},
                    {"at":456,"warning":420,"aimed":True,"capture":True,"offsets":[-17,0,17]},
                    {"at":600,"warning":564,"aimed":False,"capture":False,"offsets":[-68,-51,-34,-17,0,17,34,51,68]}]}
    ]
    schedule = []
    for group in design["formations"]:
        for i in range(group["count"]):
            schedule.append({"type":0,"at":round((group["start"]+i*group["spacing"])*60),
                             "x":0,"mirror":group["side"]=="right","reward":(2 if group["start"]<16 else 1) if i==group["rewardIndex"] else 0})
    for mob in design["attendants"]:
        schedule.append({"type":1,"at":round(mob["start"]*60),"x":mob["x"]*64,"mirror":False,"reward":1 if mob["reward"] else 0})
    for mob in design["guardians"]:
        schedule.append({"type":2,"at":round(mob["start"]*60),"x":mob["x"]*64,"mirror":False,"reward":3})
    schedule.sort(key=lambda m:(m["at"],m["type"],m["x"],m["mirror"]))
    for i,mob in enumerate(schedule):
        mob["id"] = i+1
    levels = []
    for weights in [[1,8,1],[1,2,8,2,1],[1,2,2,8,2,2,1]]:
        mid = len(weights)//2
        normal = [{"offsetX":(i-mid)*6 if mid>1 else (i-mid)*8,
                   "vxQ":(i-mid)*32 if mid>1 else (i-mid)*64,"damage":damage} for i,damage in enumerate(weights)]
        focused = [{"offsetX":(i-mid)*4,"vxQ":0,"damage":damage} for i,damage in enumerate(weights)]
        levels.append({"normal":normal,"focused":focused})
    score = rules["score"]
    resource_max = (max(rules["player"]["standardLives"],rules["assist"]["lives"])*score["remainingLifeOnClear"] +
                    max(rules["player"]["standardBombs"],rules["assist"]["bombs"])*score["remainingBombOnClear"])
    score_bound = (score["clear"]+3*score["phaseBreak"]+score["totalDamageBudget"]+
                   score["grazeBulletCap"]*score["grazePerBullet"]+resource_max+score["timeBonusCap"]+
                   sum(types[m["type"]]["killScore"] for m in schedule)+sum(m["reward"] for m in schedule)*50)
    rules["stage01"] = {
        "rule":"danmaku-stage01-r1","name":"星穹回廊","preludeTicks":4320,"gatherTick":4080,"maxTicks":17340,
        "mobCap":10,"enemyCap":96,"shotCap":96,"dropCap":24,"types":types,"paths":paths,"schedule":schedule,
        "segments":[{"at":round(s["start"]*60),"name":s["name"]} for s in design["segments"] if s["start"]<72],
        "growth":{"thresholds":[0,3,8],"maxPower":8,"levels":levels,"dropTtl":900,"hoverTicks":24,"fallStepQ":64,
                  "magnetRadius":64,"focusMagnetRadius":96,"magnetStepQ":512,"pickupRadius":14,
                  "rewardUnlockTicks":12,"recoveryUnlockTicks":60,"overflowPerUnit":50},
        "scoreUpperBound":score_bound
    }
    rules["stage01"]["bombRule"] = "danmaku-stage01-r2"
    rules["stage01"]["bomb"] = {
        "name":"星翼绽放","stockCap":3,"standardStart":2,"assistStart":3,
        "clearTicks":90,"invulnerabilityTicks":120,"cooldownTicks":120,
        "damage":300,"overflowScore":500,"rewardType":2,"rewardValue":1
    }
    rules["stage01"]["bombScoreUpperBound"] = score_bound + len(design["guardians"])*500
    RULES.write_text(json.dumps(rules,ensure_ascii=False,indent=2)+"\n",encoding="utf-8",newline="\n")
    print("Wrote stage01 rule, 40 fixed spawns and shared integer trajectory tables")


if __name__ == "__main__":
    main()
