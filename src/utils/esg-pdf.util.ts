// src/utils/esg-pdf.util.ts
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import * as fs from 'fs'
import * as path from 'path'

type ContextoType = {
  nombre_empresa: string
  pais_operacion: string
  industria: string
  tamano_empresa: string
  ubicacion_geografica: string
  modelo_negocio: string
  cadena_valor: string
  actividades_principales: string
  madurez_esg: string
  stakeholders_relevantes: string
}

type ResumenType = {
  parrafo_1: string
  parrafo_2?: string
  parrafo_3?: string
}

interface GeneratePdfParams {
  contexto: Partial<ContextoType>
  resumen: Partial<ResumenType>
  /** Si no los pasás, usa los PNG por defecto en src/assets */
  portadaPath?: string      // ruta relativa o absoluta en el backend
  contraportadaPath?: string
  /** opcional: screenshot del gráfico en base64 (data:image/png;base64,...) */
  chartImgBase64?: string
}

export async function generateEsgPdfNode({
  contexto,
  resumen,
  portadaPath,
  contraportadaPath,
  chartImgBase64,
}: GeneratePdfParams): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create()
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)

  const pageWidth = 595.28
  const pageHeight = 841.89

  /* 🎨 PALETA ADAPTIA ESG */
  const textPrimary = rgb(22 / 255, 63 / 255, 106 / 255) // #163F6A
  const sectionTitle = rgb(27 / 255, 69 / 255, 57 / 255) // #1B4539
  const boxTitleColor = rgb(97 / 255, 159 / 255, 68 / 255) // #619F44
  const boxTitleBg = rgb(194 / 255, 218 / 255, 98 / 255) // #C2DA62
  const boxBgLight = rgb(203 / 255, 220 / 255, 219 / 255) // #CBDCDB

  // ==========================
  // 📂 RUTAS DE ASSETS
  // ==========================
  // __dirname aquí es dist/utils en runtime
  const assetsRoot = path.join(__dirname, '..', 'assets')

  const logoPath = path.join(assetsRoot, 'adaptia-logo.png')
  const portadaDefaultPath = path.join(
    assetsRoot,
    'Portada-Resumen-Ejecutivo-Adaptia.png',
  )
  const contraportadaDefaultPath = path.join(
    assetsRoot,
    'Contra-Portada-Resumen-Ejecutivo-Adaptia.png',
  )

  // Logo incrustado una sola vez
  const logoBytes = fs.readFileSync(logoPath)
  const adaptiaLogo = await pdfDoc.embedPng(logoBytes)

  // ==========================
  // 📝 HELPERS DE PÁGINA
  // ==========================
  let pageIndex = 0

  const addPage = (title?: string, skipBranding = false) => {
    const page = pdfDoc.addPage([pageWidth, pageHeight])
    pageIndex++
    const { height } = page.getSize()

    // Título de sección
    if (title) {
      page.drawText(title, {
        x: 50,
        y: height - 60,
        size: 24,
        font: fontBold,
        color: sectionTitle,
      })

      page.drawLine({
        start: { x: 50, y: height - 75 },
        end: { x: pageWidth - 50, y: height - 75 },
        thickness: 2,
        color: sectionTitle,
      })
    }

    // Branding (logo + nº página)
    if (!skipBranding) {
      const logoWidth = 60
      const ratio = adaptiaLogo.height / adaptiaLogo.width
      const logoHeight = logoWidth * ratio

      page.drawImage(adaptiaLogo, {
        x: pageWidth - logoWidth - 40,
        y: height - logoHeight - 40,
        width: logoWidth,
        height: logoHeight,
      })

      page.drawText(String(pageIndex), {
        x: pageWidth - 40,
        y: 30,
        size: 10,
        font: fontRegular,
        color: textPrimary,
      })
    }

    return page
  }

  // =======================
  // 🖼️ PORTADA
  // =======================
  const portadaToUse =
    portadaPath && portadaPath.length > 0
      ? portadaPath
      : portadaDefaultPath

  if (portadaToUse && fs.existsSync(portadaToUse)) {
    const portadaAbs = path.isAbsolute(portadaToUse)
      ? portadaToUse
      : path.join(assetsRoot, portadaToUse)

    const imgBytes = fs.readFileSync(portadaAbs)
    const image = await pdfDoc.embedPng(imgBytes)
    const page = addPage(undefined, true)
    const { width, height } = page.getSize()
    page.drawImage(image, { x: 0, y: 0, width, height })
  }

  // =======================
  // 🏢 CONTEXTO
  // =======================
  let contextoPage = addPage('Contexto de la organización')
  let y = pageHeight - 110
  const leftMargin = 50
  const contentWidth = pageWidth - 100

  const drawFieldBox = (label: string, value?: string) => {
    const safeValue = value ?? ''
    const wrapped = wrapText(safeValue, 75)
    const lineHeight = 16
    const headerHeight = 25
    const paddingTop = 14
    const paddingBottom = 16

    const boxHeight =
      headerHeight + paddingTop + wrapped.length * lineHeight + paddingBottom

    if (y - boxHeight < 60) {
      contextoPage = addPage('Contexto de la organización')
      y = pageHeight - 110
    }

    // Fondo recuadro
    contextoPage.drawRectangle({
      x: leftMargin,
      y: y - boxHeight,
      width: contentWidth,
      height: boxHeight,
      color: boxBgLight,
      borderColor: boxTitleColor,
      borderWidth: 1,
    })

    // Header recuadro
    contextoPage.drawRectangle({
      x: leftMargin,
      y: y - headerHeight,
      width: contentWidth,
      height: headerHeight,
      color: boxTitleBg,
    })

    // Título
    contextoPage.drawText(label, {
      x: leftMargin + 14,
      y: y - 18,
      size: 13,
      font: fontBold,
      color: boxTitleColor,
    })

    // Texto
    let textY = y - headerHeight - paddingTop
    wrapped.forEach((line) => {
      contextoPage.drawText(line, {
        x: leftMargin + 14,
        y: textY,
        size: 11,
        font: fontRegular,
        color: textPrimary,
      })
      textY -= lineHeight
    })

    y -= boxHeight + 20
  }

  drawFieldBox('Nombre de la Empresa', contexto.nombre_empresa)
  drawFieldBox('País de Operación', contexto.pais_operacion)
  drawFieldBox('Industria', contexto.industria)
  drawFieldBox('Tamaño de la Empresa', contexto.tamano_empresa)
  drawFieldBox('Ubicación Geográfica', contexto.ubicacion_geografica)
  drawFieldBox('Modelo de Negocio', contexto.modelo_negocio)
  drawFieldBox('Cadena de Valor', contexto.cadena_valor)
  drawFieldBox('Actividades Principales', contexto.actividades_principales)
  drawFieldBox('Madurez ESG', contexto.madurez_esg)

  // 👥 Stakeholders
  const stakeholdersRaw = contexto.stakeholders_relevantes ?? ''
  const stakeholders = stakeholdersRaw
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  if (stakeholders.length) {
    const headerHeight = 25
    const lineHeight = 16
    const paddingTop = 12
    const paddingBottom = 16

    const allLines = stakeholders.flatMap((s) =>
      wrapText(`• ${s}`, 75),
    )

    let index = 0
    while (index < allLines.length) {
      let available = y - 60
      let maxLines = Math.floor(
        (available - (headerHeight + paddingTop + paddingBottom)) /
          lineHeight,
      )

      if (maxLines <= 0) {
        contextoPage = addPage('Contexto de la organización')
        y = pageHeight - 110
        available = y - 60
        maxLines = Math.floor(
          (available - (headerHeight + paddingTop + paddingBottom)) /
            lineHeight,
        )
      }

      const batch = allLines.slice(index, index + maxLines)
      const boxHeight =
        headerHeight + paddingTop + paddingBottom + batch.length * lineHeight

      contextoPage.drawRectangle({
        x: leftMargin,
        y: y - boxHeight,
        width: contentWidth,
        height: boxHeight,
        color: boxBgLight,
        borderColor: boxTitleColor,
        borderWidth: 1,
      })

      contextoPage.drawRectangle({
        x: leftMargin,
        y: y - headerHeight,
        width: contentWidth,
        height: headerHeight,
        color: boxTitleBg,
      })

      contextoPage.drawText('Stakeholders Relevantes', {
        x: leftMargin + 14,
        y: y - 18,
        size: 13,
        font: fontBold,
        color: boxTitleColor,
      })

      let textY = y - headerHeight - paddingTop
      batch.forEach((line) => {
        contextoPage.drawText(line, {
          x: leftMargin + 18,
          y: textY,
          size: 11,
          font: fontRegular,
          color: textPrimary,
        })
        textY -= lineHeight
      })

      y -= boxHeight + 20
      index += batch.length
    }
  }

  // ==========================
  // 📊 MATRIZ DE MATERIALIDAD
  // ==========================
  if (chartImgBase64) {
    const raw = chartImgBase64.replace(/^data:image\/png;base64,/, '')
    const chartBytes = Buffer.from(raw, 'base64')
    const image = await pdfDoc.embedPng(chartBytes)
    const chartPage = addPage('Matriz de Materialidad')

    const maxWidth = pageWidth - 80
    const maxHeight = pageHeight - 180

    const ratio = image.height / image.width
    let width = maxWidth
    let height = width * ratio

    if (height > maxHeight) {
      height = maxHeight
      width = height / ratio
    }

    chartPage.drawImage(image, {
      x: (pageWidth - width) / 2,
      y: (pageHeight - height) / 2 - 10,
      width,
      height,
    })
  }

  // ==========================
  // 📘 RESUMEN EJECUTIVO
  // ==========================
  let resumenPage = addPage('Resumen Ejecutivo')
  y = pageHeight - 130

  resumenPage.drawText('Estrategia de Sostenibilidad Recomendada', {
    x: leftMargin,
    y,
    size: 14,
    font: fontBold,
    color: sectionTitle,
  })

  y -= 25

  const addParagraph = (rawText?: string | null) => {
    if (!rawText || !rawText.trim()) return

    const fontSize = 12
    const lineHeight = 16
    const maxW = contentWidth

    const lines = wrapTextByWidth(rawText, fontRegular, fontSize, maxW)
    const boxHeight = lines.length * lineHeight + 20

    if (y - boxHeight < 60) {
      resumenPage = addPage('Resumen Ejecutivo')
      y = pageHeight - 130
    }

    resumenPage.drawRectangle({
      x: leftMargin,
      y: y - boxHeight,
      width: maxW,
      height: boxHeight,
      color: boxBgLight,
      borderColor: boxTitleColor,
      borderWidth: 1,
    })

    let textY = y - 15
    lines.forEach((line) => {
      resumenPage.drawText(line, {
        x: leftMargin + 12,
        y: textY,
        size: fontSize,
        font: fontRegular,
        color: textPrimary,
      })
      textY -= lineHeight
    })

    y -= boxHeight + 20
  }

  addParagraph(resumen.parrafo_1)
  addParagraph(resumen.parrafo_2)
  addParagraph(resumen.parrafo_3)

  // ==========================
  // 🖼️ CONTRAPORTADA
  // ==========================
  const contraToUse =
    contraportadaPath && contraportadaPath.length > 0
      ? contraportadaPath
      : contraportadaDefaultPath

  if (contraToUse && fs.existsSync(contraToUse)) {
    const contraAbs = path.isAbsolute(contraToUse)
      ? contraToUse
      : path.join(assetsRoot, contraToUse)

    const imgBytes = fs.readFileSync(contraAbs)
    const image = await pdfDoc.embedPng(imgBytes)
    const page = addPage(undefined, true)
    const { width, height } = page.getSize()
    page.drawImage(image, { x: 0, y: 0, width, height })
  }

  return pdfDoc.save()
}

/* ==========================
   HELPERS DE TEXTO
========================== */
function wrapText(text: string | undefined | null, maxChars: number) {
  const safeText = text ?? ''
  const words = safeText.split(' ')
  const lines: string[] = []
  let current = ''
  for (const w of words) {
    if ((current + w).length > maxChars) {
      lines.push(current.trim())
      current = w + ' '
    } else current += w + ' '
  }
  if (current.trim()) lines.push(current.trim())
  return lines
}

function wrapTextByWidth(
  text: string | undefined | null,
  font: any,
  size: number,
  maxWidth: number,
) {
  const safeText = text ?? ''
  const words = safeText.split(' ')
  const lines: string[] = []
  let current = ''

  for (const w of words) {
    const test = current + w + ' '
    const width = font.widthOfTextAtSize(test, size)

    if (width > maxWidth) {
      lines.push(current.trim())
      current = w + ' '
    } else {
      current += w + ' '
    }
  }

  if (current.trim()) lines.push(current.trim())
  return lines
}
