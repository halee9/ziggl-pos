import { useState } from 'react';
import { ArrowLeft, ChevronRight, Phone, Flag, Camera, QrCode, CheckCircle, Clock, AlertTriangle, Globe } from 'lucide-react';

/* ── Types ── */
type Lang = 'en' | 'ko' | 'mn' | 'es';

interface GuideStepText {
  title: string;
  description: string;
  tip?: string;
}

interface GuideStep {
  icon: React.ReactNode;
  text: Record<Lang, GuideStepText>;
}

interface Guide {
  id: string;
  icon: React.ReactNode;
  color: string;
  text: Record<Lang, { title: string; subtitle: string }>;
  steps: GuideStep[];
}

/* ── UI strings ── */
const ui: Record<Lang, { pageTitle: string; pageSubtitle: string; back: string; tip: string }> = {
  en: { pageTitle: 'Help & Guides', pageSubtitle: 'Step-by-step guides for common situations', back: 'Back to Guides', tip: 'Tip' },
  ko: { pageTitle: '도움말', pageSubtitle: '자주 발생하는 상황별 가이드', back: '목록으로', tip: '팁' },
  mn: { pageTitle: 'Тусламж', pageSubtitle: 'Нийтлэг нөхцөл байдлын алхам алхмаар зааварчилгаа', back: 'Жагсаалт руу', tip: 'Зөвлөгөө' },
  es: { pageTitle: 'Ayuda y Guías', pageSubtitle: 'Guías paso a paso para situaciones comunes', back: 'Volver a Guías', tip: 'Consejo' },
};

const langLabels: Record<Lang, string> = { en: 'EN', ko: '한국어', mn: 'MN', es: 'ES' };

/* ── Guides data ── */
const guides: Guide[] = [
  {
    id: 'unclaimed-order',
    icon: <AlertTriangle size={24} />,
    color: 'border-l-orange-500',
    text: {
      en: { title: 'Unclaimed Order', subtitle: 'Customer did not pick up their order' },
      ko: { title: '미수령 주문', subtitle: '고객이 주문을 픽업하지 않은 경우' },
      mn: { title: 'Авагдаагүй захиалга', subtitle: 'Үйлчлүүлэгч захиалгаа аваагүй тохиолдолд' },
      es: { title: 'Pedido no reclamado', subtitle: 'El cliente no recogió su pedido' },
    },
    steps: [
      {
        icon: <Phone size={20} />,
        text: {
          en: {
            title: 'Check for phone number',
            description: 'Open the order in the Orders screen and look for the customer phone number below the payment info.',
            tip: 'If a phone number is available, call the customer after 1 hour past the expected pickup time to confirm pickup.',
          },
          ko: {
            title: '전화번호 확인',
            description: 'Orders 화면에서 해당 주문을 열고, 결제 정보 아래에 고객 전화번호가 있는지 확인합니다.',
            tip: '전화번호가 있으면, 예상 픽업 시간으로부터 1시간 후에 고객에게 전화하여 픽업 여부를 확인합니다.',
          },
          mn: {
            title: 'Утасны дугаар шалгах',
            description: 'Orders дэлгэцээс захиалгыг нээж, төлбөрийн мэдээллийн доор үйлчлүүлэгчийн утасны дугаарыг хайна уу.',
            tip: 'Утасны дугаар байгаа бол товлосон авах цагаас 1 цагийн дараа үйлчлүүлэгч рүү залгаж авах эсэхийг баталгаажуулна уу.',
          },
          es: {
            title: 'Verificar número de teléfono',
            description: 'Abra el pedido en la pantalla de Orders y busque el número de teléfono del cliente debajo de la información de pago.',
            tip: 'Si hay un número de teléfono disponible, llame al cliente 1 hora después de la hora de recogida esperada para confirmar.',
          },
        },
      },
      {
        icon: <Clock size={20} />,
        text: {
          en: {
            title: 'No phone number — wait until closing',
            description: 'If there is no phone number on the order, keep the order until the store closes for the day.',
          },
          ko: {
            title: '전화번호 없음 — 마감까지 대기',
            description: '주문에 전화번호가 없으면, 당일 가게 마감 시간까지 주문을 보관합니다.',
          },
          mn: {
            title: 'Дугаар байхгүй — хаах хүртэл хүлээх',
            description: 'Захиалгад утасны дугаар байхгүй бол тухайн өдрийн хаалтын цаг хүртэл захиалгыг хадгална.',
          },
          es: {
            title: 'Sin teléfono — esperar hasta el cierre',
            description: 'Si no hay número de teléfono en el pedido, conserve el pedido hasta la hora de cierre de la tienda.',
          },
        },
      },
      {
        icon: <Flag size={20} />,
        text: {
          en: {
            title: 'Flag the order as Unclaimed',
            description: 'Go to the Orders page and click on the unclaimed order. In the order detail panel, find the FLAG section and click the "Unclaimed" button. Also click the "Evidence" button.',
            tip: 'Both "Unclaimed" and "Evidence" flags must be set for proper record-keeping.',
          },
          ko: {
            title: '주문에 Unclaimed 플래그 설정',
            description: 'Orders 페이지에서 해당 주문을 클릭합니다. 주문 상세 패널의 FLAG 섹션에서 "Unclaimed" 버튼과 "Evidence" 버튼을 모두 클릭합니다.',
            tip: '"Unclaimed"과 "Evidence" 플래그를 모두 설정해야 기록이 올바르게 유지됩니다.',
          },
          mn: {
            title: 'Захиалгыг Unclaimed гэж тэмдэглэх',
            description: 'Orders хуудсанд очиж захиалгыг дарна. Захиалгын дэлгэрэнгүй самбараас FLAG хэсгийг олж "Unclaimed" товчийг дарна. Мөн "Evidence" товчийг дарна.',
            tip: 'Бүртгэлийг зөв хөтлөхийн тулд "Unclaimed" болон "Evidence" хоёулаа тэмдэглэсэн байх шаардлагатай.',
          },
          es: {
            title: 'Marcar el pedido como No Reclamado',
            description: 'Vaya a la página de Orders y haga clic en el pedido no reclamado. En el panel de detalles, encuentre la sección FLAG y haga clic en "Unclaimed". También haga clic en "Evidence".',
            tip: 'Ambas marcas "Unclaimed" y "Evidence" deben establecerse para un registro adecuado.',
          },
        },
      },
      {
        icon: <Camera size={20} />,
        text: {
          en: {
            title: 'Click "Phone Upload"',
            description: 'Below the FLAG section, find the PHOTOS section and click the "Phone Upload" button.',
          },
          ko: {
            title: '"Phone Upload" 클릭',
            description: 'FLAG 섹션 아래에 있는 PHOTOS 섹션에서 "Phone Upload" 버튼을 클릭합니다.',
          },
          mn: {
            title: '"Phone Upload" дарах',
            description: 'FLAG хэсгийн доор PHOTOS хэсгийг олж "Phone Upload" товчийг дарна.',
          },
          es: {
            title: 'Clic en "Phone Upload"',
            description: 'Debajo de la sección FLAG, encuentre la sección PHOTOS y haga clic en el botón "Phone Upload".',
          },
        },
      },
      {
        icon: <QrCode size={20} />,
        text: {
          en: {
            title: 'Scan QR code with your phone',
            description: 'A popup will appear with a QR code. Open your phone camera and scan the QR code.',
          },
          ko: {
            title: '폰으로 QR 코드 스캔',
            description: 'QR 코드가 포함된 팝업이 뜹니다. 핸드폰 카메라를 열어 QR 코드를 스캔합니다.',
          },
          mn: {
            title: 'Утсаараа QR код уншуулах',
            description: 'QR код бүхий цонх гарч ирнэ. Утасныхаа камерыг нээж QR кодыг уншуулна.',
          },
          es: {
            title: 'Escanear código QR con su teléfono',
            description: 'Aparecerá una ventana emergente con un código QR. Abra la cámara de su teléfono y escanee el código QR.',
          },
        },
      },
      {
        icon: <Camera size={20} />,
        text: {
          en: {
            title: 'Upload page opens on your phone',
            description: 'Your phone browser will open an upload page. Tap the camera button to take a photo.',
            tip: 'Take a clear photo of the prepared food items together with the printed order ticket.',
          },
          ko: {
            title: '폰 브라우저에서 업로드 화면 열림',
            description: '폰의 브라우저에서 업로드 페이지가 열립니다. 카메라 버튼을 탭하여 사진을 촬영합니다.',
            tip: '준비된 음식과 출력된 주문 티켓을 함께 선명하게 촬영합니다.',
          },
          mn: {
            title: 'Утасны хөтөч дээр байршуулах хуудас нээгдэнэ',
            description: 'Утасны хөтөч дээр байршуулах хуудас нээгдэнэ. Камерын товчийг дарж зураг авна.',
            tip: 'Бэлтгэсэн хоол болон хэвлэсэн захиалгын тасалбарыг хамт тодорхой зураг авна уу.',
          },
          es: {
            title: 'Se abre la página de carga en su teléfono',
            description: 'El navegador de su teléfono abrirá una página de carga. Toque el botón de cámara para tomar una foto.',
            tip: 'Tome una foto clara de los alimentos preparados junto con el ticket de pedido impreso.',
          },
        },
      },
      {
        icon: <Camera size={20} />,
        text: {
          en: {
            title: 'Take a photo of the order + ticket',
            description: 'Place the order ticket next to the food items and take a photo. This serves as evidence that the order was prepared and not picked up.',
            tip: 'Make sure both the food and the ticket are clearly visible in the photo.',
          },
          ko: {
            title: '주문 음식 + 티켓 함께 촬영',
            description: '주문 티켓을 음식 옆에 놓고 사진을 촬영합니다. 주문이 준비되었으나 픽업되지 않았다는 증거로 사용됩니다.',
            tip: '음식과 티켓이 사진에 모두 선명하게 보여야 합니다.',
          },
          mn: {
            title: 'Захиалга + тасалбарыг хамт зурагла',
            description: 'Захиалгын тасалбарыг хоолны хажууд тавьж зураг авна. Энэ нь захиалга бэлтгэгдсэн боловч аваагүй гэсэн нотолгоо болно.',
            tip: 'Хоол болон тасалбар хоёулаа зурган дээр тод харагдаж байгаа эсэхийг шалгана уу.',
          },
          es: {
            title: 'Tomar foto del pedido + ticket',
            description: 'Coloque el ticket de pedido junto a los alimentos y tome una foto. Esto sirve como evidencia de que el pedido fue preparado pero no recogido.',
            tip: 'Asegúrese de que tanto la comida como el ticket sean claramente visibles en la foto.',
          },
        },
      },
      {
        icon: <CheckCircle size={20} />,
        text: {
          en: {
            title: 'Confirm upload and finish',
            description: 'After uploading, go back to the POS order detail and verify that the photo appears in the PHOTOS section. Once confirmed, you are done.',
          },
          ko: {
            title: '업로드 확인 후 완료',
            description: '업로드 후 POS 주문 상세 화면으로 돌아가 PHOTOS 섹션에 사진이 나타나는지 확인합니다. 확인되면 작업 완료입니다.',
          },
          mn: {
            title: 'Байршуулалтыг баталгаажуулж дуусгах',
            description: 'Байршуулсны дараа POS захиалгын дэлгэрэнгүй рүү буцаж PHOTOS хэсэгт зураг гарч ирсэн эсэхийг шалгана. Баталгаажуулсны дараа та дуусгасан.',
          },
          es: {
            title: 'Confirmar carga y finalizar',
            description: 'Después de cargar, vuelva al detalle del pedido en POS y verifique que la foto aparezca en la sección PHOTOS. Una vez confirmado, ha terminado.',
          },
        },
      },
    ],
  },
];

/* ── Component ── */
export default function HelpScreen() {
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [lang, setLang] = useState<Lang>('en');

  const t = ui[lang];

  if (selectedGuide) {
    const guideText = selectedGuide.text[lang];
    return (
      <div className="h-full overflow-auto bg-background">
        <div className="max-w-3xl mx-auto px-6 py-6">
          {/* Top bar: back + lang */}
          <div className="flex items-center justify-between mb-6">
            <button
              onClick={() => setSelectedGuide(null)}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft size={18} />
              <span className="text-sm font-medium">{t.back}</span>
            </button>
            <LangSelector lang={lang} setLang={setLang} />
          </div>

          {/* Guide header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">{guideText.title}</h1>
            <p className="text-muted-foreground mt-1">{guideText.subtitle}</p>
          </div>

          {/* Steps */}
          <div className="space-y-1">
            {selectedGuide.steps.map((step, idx) => {
              const stepText = step.text[lang];
              return (
                <div key={idx} className="relative flex gap-4">
                  {/* Timeline */}
                  <div className="flex flex-col items-center">
                    <div className="w-10 h-10 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                      {idx + 1}
                    </div>
                    {idx < selectedGuide.steps.length - 1 && (
                      <div className="w-0.5 flex-1 bg-border my-1" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="pb-8 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-primary">{step.icon}</span>
                      <h3 className="font-semibold text-foreground">{stepText.title}</h3>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">{stepText.description}</p>
                    {stepText.tip && (
                      <div className="mt-2 px-3 py-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 text-xs text-yellow-200">
                        <span className="font-semibold">{t.tip}:</span> {stepText.tip}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto bg-background">
      <div className="max-w-3xl mx-auto px-6 py-6">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-2xl font-bold text-foreground">{t.pageTitle}</h1>
          <LangSelector lang={lang} setLang={setLang} />
        </div>
        <p className="text-muted-foreground mb-6">{t.pageSubtitle}</p>

        <div className="space-y-3">
          {guides.map((guide) => {
            const guideText = guide.text[lang];
            return (
              <button
                key={guide.id}
                onClick={() => setSelectedGuide(guide)}
                className={`w-full text-left p-4 rounded-lg border border-border ${guide.color} border-l-4 bg-card hover:bg-secondary/50 transition-colors flex items-center gap-4`}
              >
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
                  {guide.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">{guideText.title}</h3>
                  <p className="text-sm text-muted-foreground">{guideText.subtitle}</p>
                </div>
                <ChevronRight size={20} className="text-muted-foreground" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ── Language selector ── */
function LangSelector({ lang, setLang }: { lang: Lang; setLang: (l: Lang) => void }) {
  return (
    <div className="flex items-center gap-1">
      <Globe size={16} className="text-muted-foreground mr-1" />
      {(Object.keys(langLabels) as Lang[]).map((l) => (
        <button
          key={l}
          onClick={() => setLang(l)}
          className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
            lang === l
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
          }`}
        >
          {langLabels[l]}
        </button>
      ))}
    </div>
  );
}
