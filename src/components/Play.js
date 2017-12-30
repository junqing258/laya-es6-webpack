import Gem from "./Gem";
import { randomNum } from "utils/util";

const { Event, Handler, Tween, Ease } = Laya;

const COLORS = ["b","g","r","p"];
const ROWS = 8, COLS = 8;
const GEM_SIZE = 80;
const MIN_CLEAR = 3;

var gems = {};
var selectGem = null, nextGem = null, afterCanClear = false;
var resetGems = [];
var startXY = {x: 0, y: 0};
var waitKill_V = [], waitKill_H = [];
var waitMove = false;
var ctList = [];
var ctGems = [];
var textStep, textScore = 0;


export default class Play extends Laya.Sprite {

    constructor() {
        super();
        Laya.SoundManager.playMusic("res/bg.mp3", 0);
        this.bg = new Laya.Image("res/bg_cells.png");
        this.bg.pos(-28, -21);
        this.scrollRect = new Laya.Rectangle(-28, -21, 685, 685);
        this.addChild(this.bg);
        this.create();
        this.initScore();
    }

    initScore() {
        let panle = this.scrollPanel = new Laya.Text();
        panle.font = "prizeFont";
        panle.zOrder = 10;
        panle.width = 300;
        panle.align = "center";
        panle.text = textScore;
        panle.pos(1020, 50);
        Laya.stage.addChild(panle);
    }

    create() {
        for (var i = 0; i < COLS; i++) {
            for (var j = 0; j < ROWS; j++) {
                let gem = new Gem();
                this.randomColor(gem);
                this.setGem(gem, i, j);
                gem.inputEnabled = true;
                gem.on(Event.MOUSE_DOWN, this, this.touchGem, [gem]);
            }
        }
        this.on(Event.MOUSE_UP, this, this.releaseGem);
        this.on(Event.MOUSE_MOVE, this, (event)=> {
            this.moveGem(event.stageX-this.x-28, event.stageY-this.y-21);
        });
        this.fillGems();
    }

    fillGems() {
        Object.keys(gems).forEach(id=> {
            let gem = gems[id];
            this.randomColor(gem);
            gem.pos(gem.posX*GEM_SIZE+GEM_SIZE/2, gem.posY*GEM_SIZE+GEM_SIZE/2);
            this.addChild(gem);
        });
    }

    review () {
        afterCanClear = false;
        for (let i = 0; i < COLS; i++) {
            for (let j = 0; j < ROWS; j++) {
                let g = this.getGem(i, j);
                if (g.needReview) {
                    this.killGem(g);
                }
            }
        }
        if (afterCanClear) {
            this.clearGems();
        } else {
            afterCanClear = false;
            waitMove = false;
        }
    }

    touchGem(gem) {
        if (waitMove) {
            return false;
        }
        selectGem = gem;
        startXY.x = gem.posX;
        startXY.y = gem.posY;
    }

    moveGem(x, y) {
        if (selectGem/* && pointer.isDown*/) {
            x = Math.floor(x / GEM_SIZE);
            y = Math.floor(y / GEM_SIZE);
            if (this.checkCanMove(x, y)) {
                // gems.bringToTop(selectGem);
                this.tweenGem(selectGem, x, y);
                if (nextGem) {
                    this.tweenGem(nextGem, selectGem.posX, selectGem.posY);
                    this.swapGem(selectGem, nextGem);
                }
                nextGem = this.getGem(x, y);
                if (nextGem == selectGem) {
                    nextGem = null;
                } else {
                    this.tweenGem(nextGem, selectGem.posX, selectGem.posY);
                    this.swapGem(selectGem, nextGem);
                }
            }
        }
    }

    tweenGem(gem, nextX, nextY, count, cb) {
        count = count || 1;
        Tween.to(gem, {x: nextX*GEM_SIZE+GEM_SIZE/2, y: nextY*GEM_SIZE+GEM_SIZE/2}, 50*count, Ease.sineOut, Handler.create(this, ()=> {
            if (typeof cb === "function") cb();
        }));
    }

    swapGem(g1, g2) {
        var tempX = g1.posX,
            tempY = g1.posY;
        this.setGem(g1, g2.posX, g2.posY);
        this.setGem(g2, tempX, tempY);
    }

    releaseGem() {
        if (nextGem === null) {
            selectGem = null;
            return false;
        }
        this.killGem(selectGem);
        this.killGem(nextGem);
        if (afterCanClear) {
            waitMove = true;
            this.clearGems();
            this.updateText();
        } else {
            this.tweenGem(selectGem, nextGem.posX, nextGem.posY);
            this.tweenGem(nextGem, selectGem.posX, selectGem.posY);
            this.swapGem(selectGem, nextGem);
        }

        afterCanClear = false;
        selectGem = null;
        nextGem = null;
    }

    killGem (gem) {
        this.countGemOnWay(gem, 0, -1);
        this.countGemOnWay(gem, 0, 1);
        this.countGemOnWay(gem, -1, 0);
        this.countGemOnWay(gem, 1, 0);
        if (waitKill_H.length + 1 >= MIN_CLEAR) {
            gem.kill();
            textScore++;
            waitKill_H.forEach(g=> {
                g.kill();
                textScore++;
            });
            afterCanClear = true;
        }
        if (waitKill_V.length + 1 >= MIN_CLEAR) {
            gem.kill();
            textScore++;
            waitKill_V.forEach(g=> {
                g.kill();
                textScore++;
            });
            afterCanClear = true;
        }
        waitKill_V = [];
        waitKill_H = [];
    }

    // 遍历全图将所有已被挪走的位置坠落填充
    dropGems() {
        var max = 0;
        for (var j = 0; j < COLS; j++) {
            var dropCount = 0;
            for (var i = ROWS - 1; i >= 0; i--) {
                var g = this.getGem(j, i);
                if (g && !g.alive) {
                    dropCount++;
                } else if (dropCount > 0) {
                    this.tweenGem(g, j, i + dropCount, dropCount);
                    this.setGem(g, j, i + dropCount);
                    g.needReview = true;
                }
            }
            max = Math.max(max, dropCount);
        }
        Laya.timer.once(max * 100, this, ()=> this.refill());
    }

    clearGems () {
        for (let i = 0; i < COLS; i++) {
            let ct = 1;
            ctGems[i] = {};
            for (let j = 0; j < ROWS; j++) {
                let g = this.getGem(i, j);
                if (g && !g.alive) {
                    this.setGem(g, g.posX, -ct);
                    ctGems[i][-ct] = g;
                    ct++;
                    this.updateText();
                }
            }
            ctList[i] = ct - 1;
        }
        Laya.timer.once(300, this, this.dropGems);
    }

    // 把最顶上的空缺用场景外的方块重新填充
    refill() {
        for (let i = 0; i < COLS; i++) {
            let ct = ctList[i];
            if (!ct) continue;
            let ctCols = ctGems[i];
            for (let j = 0; j < ct; j++) {
                let posY = -j-1;
                let gem = ctCols[posY];
                // if (!gem) continue;
                gem.color = COLORS[randomNum(3)];
                gem.reset();

                gem.pos(gem.posX*GEM_SIZE+GEM_SIZE/2, posY*GEM_SIZE+GEM_SIZE/2);
                this.tweenGem(gem, gem.posX, posY+ct, ct);
                this.setGem(gem, gem.posX, posY+ct);
            }
        }

        Laya.timer.once(Math.max.apply(null, ctList) * 200, this, ()=> {
            this.review()
        });
    }

    checkCanMove(toX, toY) {
        if (toX < 0 || toX >= COLS || toY < 0 || toY >= ROWS) {
            return false;
        }
        if (toX === selectGem.x && toY === selectGem.y) {
            return false;
        }
        if (startXY.x == toX && Math.abs(startXY.y - toY) <= 1) {
            return true;
        }
        if (startXY.y == toY && Math.abs(startXY.x - toX) <= 1) {
            return true;
        }
        return false;
    }

    countGemOnWay (gem, x, y) {
        var count = 0,
            next = null,
            nextX = gem.posX + x,
            nextY = gem.posY + y;
        while (nextX >= 0 && nextX < COLS && nextY >= 0 && nextY < ROWS) {
            next = this.getGem(nextX, nextY)
            if (next && next.color == gem.color) {
                if (x == 0) {
                    waitKill_V.push(next);
                } else {
                    waitKill_H.push(next);
                }
                nextX += x;
                nextY += y;
            } else {
                break;
            }
        }
    }

    randomColor(gem) {
        var prev1x = this.getGem(gem.posX - 1, gem.posY),
            prev2x = this.getGem(gem.posX - 2, gem.posY),
            prev1y = this.getGem(gem.posX, gem.posY - 1),
            prev2y = this.getGem(gem.posX, gem.posY - 2);
        var xColor = prev1x && prev2x && prev1x.color == prev2x.color && prev1x.color,
            yColor = prev1y && prev2y && prev1y.color == prev2y.color && prev1y.color;
        do {
            gem.color = COLORS[randomNum(3)];
        } while (gem.color === xColor || gem.color === yColor);
        gem.reset();
    }

    setGem(gem, x, y) {
        gem.posX = x;
        gem.posY = y;
        gem.id = this.calcGemId(x, y);
        gems[gem.id] = gem;
    }

    getGem(x, y) {
        let gid = Object.keys(gems).find(id=> this.calcGemId(x, y)==id);
        return gems[gid];
    }

    calcGemId (x, y) {
        return x + y * COLS;
    }

    uncalcGemId(id) {
        return [id%COLS, Math.floor(id/COLS)];
    }

    updateText() {
        this.scrollPanel.text = textScore;
    }

}