from pathlib import Path
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT, TA_RIGHT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak, KeepTogether

ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "output" / "pdf" / "mebelflow-stage8-sample.pdf"
OUTPUT.parent.mkdir(parents=True, exist_ok=True)

font_regular = Path("C:/Windows/Fonts/arial.ttf")
font_bold = Path("C:/Windows/Fonts/arialbd.ttf")
pdfmetrics.registerFont(TTFont("Mebel", str(font_regular)))
pdfmetrics.registerFont(TTFont("Mebel-Bold", str(font_bold)))

accent = colors.HexColor("#8A5A3B")
ink = colors.HexColor("#26231F")
muted = colors.HexColor("#6C655D")
surface = colors.HexColor("#F5F1EA")

styles = {
    "title": ParagraphStyle("title", fontName="Mebel-Bold", fontSize=20, leading=25, textColor=ink, spaceAfter=7*mm),
    "h2": ParagraphStyle("h2", fontName="Mebel-Bold", fontSize=12, leading=15, textColor=accent, spaceBefore=4*mm, spaceAfter=3*mm),
    "body": ParagraphStyle("body", fontName="Mebel", fontSize=9.5, leading=14, textColor=ink),
    "small": ParagraphStyle("small", fontName="Mebel", fontSize=7.5, leading=10, textColor=muted),
    "price": ParagraphStyle("price", fontName="Mebel-Bold", fontSize=16, leading=20, textColor=ink),
}

def header_footer(canvas, doc):
    canvas.saveState()
    canvas.setStrokeColor(colors.HexColor("#D8CFC2"))
    canvas.line(18*mm, 18*mm, 192*mm, 18*mm)
    canvas.setFont("Mebel", 7.5)
    canvas.setFillColor(muted)
    canvas.drawString(18*mm, 12*mm, "Grand Mebel · +7 701 123 45 67 · Предварительное ТЗ")
    canvas.drawRightString(192*mm, 12*mm, f"Страница {doc.page}")
    canvas.restoreState()

doc = SimpleDocTemplate(str(OUTPUT), pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=18*mm, bottomMargin=24*mm, title="Предварительное ТЗ MebelFlow AI")
story = []
story.append(Table([[Paragraph("GRAND MEBEL", styles["h2"]), Paragraph("02 августа 2026", ParagraphStyle("date", parent=styles["small"], alignment=TA_RIGHT))]], colWidths=[100*mm, 74*mm], style=TableStyle([("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("LINEBELOW", (0,0), (-1,-1), 1.2, accent), ("BOTTOMPADDING", (0,0), (-1,-1), 4*mm)])))
story.append(Spacer(1, 8*mm))
story.append(Paragraph("Предварительное техническое задание на кухню", styles["title"]))
story.append(Paragraph("Проект подготовлен по диалогу с клиентом. Все размеры и цены требуют проверки мебельщиком.", styles["body"]))
story.append(Paragraph("Исходные данные", styles["h2"]))
story.append(Table([
    ["Клиент", "Мурат · +7 701 765 43 21"], ["Стена", "3000 мм"], ["Высота помещения", "2700 мм"], ["Компоновка", "Прямая кухня, одна стена"]
], colWidths=[52*mm, 122*mm], style=TableStyle([("FONTNAME", (0,0), (-1,-1), "Mebel"), ("FONTSIZE", (0,0), (-1,-1), 9), ("TEXTCOLOR", (0,0), (0,-1), muted), ("BACKGROUND", (0,0), (-1,-1), surface), ("BOX", (0,0), (-1,-1), .5, colors.HexColor("#D8CFC2")), ("INNERGRID", (0,0), (-1,-1), .25, colors.HexColor("#DED6CB")), ("LEFTPADDING", (0,0), (-1,-1), 3*mm), ("TOPPADDING", (0,0), (-1,-1), 2.5*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 2.5*mm)])))
story.append(Paragraph("Схема", styles["h2"]))
scheme = Table([["Мойка\n800 мм", "ПММ\n600 мм", "Ящики\n600 мм", "Свободно\n1000 мм"]], colWidths=[46.4*mm, 34.8*mm, 34.8*mm, 58*mm], rowHeights=[35*mm], style=TableStyle([("FONTNAME", (0,0), (-1,-1), "Mebel-Bold"), ("FONTSIZE", (0,0), (-1,-1), 8.5), ("ALIGN", (0,0), (-1,-1), "CENTER"), ("VALIGN", (0,0), (-1,-1), "MIDDLE"), ("BACKGROUND", (0,0), (2,0), colors.HexColor("#E7DED2")), ("BACKGROUND", (3,0), (3,0), colors.white), ("BOX", (0,0), (-1,-1), 1, ink), ("INNERGRID", (0,0), (-1,-1), .75, ink)]))
story.append(scheme)
story.append(Spacer(1, 2*mm))
story.append(Paragraph("Фронтальный эскиз. Не является производственным чертежом.", styles["small"]))
story.append(PageBreak())
story.append(Paragraph("Состав модулей", styles["title"]))
module_data = [["№", "Модуль", "Ширина", "Позиция"], ["1", "Тумба под мойку", "800 мм", "0 мм"], ["2", "Посудомоечная машина", "600 мм", "800 мм"], ["3", "Тумба с ящиками", "600 мм", "1400 мм"]]
story.append(Table(module_data, colWidths=[14*mm, 92*mm, 34*mm, 34*mm], repeatRows=1, style=TableStyle([("FONTNAME", (0,0), (-1,0), "Mebel-Bold"), ("FONTNAME", (0,1), (-1,-1), "Mebel"), ("FONTSIZE", (0,0), (-1,-1), 9), ("BACKGROUND", (0,0), (-1,0), accent), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("GRID", (0,0), (-1,-1), .5, colors.HexColor("#D8CFC2")), ("TOPPADDING", (0,0), (-1,-1), 3*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 3*mm)])))
story.append(Paragraph("Стиль и материалы", styles["h2"]))
story.append(Paragraph("Джапанди · палитра «Шалфей» · фасад из шпонированного МДФ. Скрытые ручки, светлый компакт-ламинат для столешницы.", styles["body"]))
story.append(KeepTogether([Paragraph("Предварительная стоимость", styles["h2"]), Paragraph("900 000–1 100 000 ₸", styles["price"]), Spacer(1, 2*mm), Paragraph("Диапазон рассчитан по формуле версии 3. Точные материалы, фурнитура и монтаж уточняются после замера.", styles["body"])]))
story.append(Spacer(1, 8*mm))
story.append(Table([[Paragraph("ВАЖНО", styles["h2"]), Paragraph("Предварительная схема и стоимость служат для первичного согласования. Точные размеры, материалы, конструкция и окончательная цена подтверждаются мебельщиком после проверки и замера.", styles["body"])]], colWidths=[30*mm, 144*mm], style=TableStyle([("BACKGROUND", (0,0), (-1,-1), surface), ("BOX", (0,0), (-1,-1), 1, accent), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 4*mm), ("RIGHTPADDING", (0,0), (-1,-1), 4*mm), ("TOPPADDING", (0,0), (-1,-1), 4*mm), ("BOTTOMPADDING", (0,0), (-1,-1), 4*mm)])))
story.append(Spacer(1, 10*mm))
story.append(Paragraph("Следующий шаг: согласовать удобное время замера по телефону +7 701 123 45 67.", styles["body"]))

doc.build(story, onFirstPage=header_footer, onLaterPages=header_footer)
print(OUTPUT)
