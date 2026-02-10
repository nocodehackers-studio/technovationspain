interface ConsentLegalTextProps {
  participantName: string;
  participantAge?: number;
  eventName: string;
  eventDate: string;
  eventLocation?: string;
  signerName?: string;
}

export function ConsentLegalText({
  participantName,
  participantAge,
  eventName,
  eventDate,
  eventLocation,
  signerName,
}: ConsentLegalTextProps) {
  return (
    <div className="space-y-4 text-sm">
      <h3 className="text-center font-bold uppercase text-base">
        Aviso Legal para la Recogida de Datos de Carácter Personal
      </h3>

      <p>
        <strong>Nombre y apellidos del Titular:</strong>{' '}
        <span className="text-primary font-semibold">{participantName}</span>
        {participantAge !== undefined && (
          <> de <span className="text-primary font-semibold">{participantAge}</span> años</>
        )}
      </p>

      <p className="text-muted-foreground leading-relaxed">
        Asociación Power to Code con NIF G-88095351 (en adelante "Power to Code") y domicilio a efectos de notificaciones en Plaza de Segovia 5, 28600, Navalcarnero, Madrid, respeta la legislación vigente en materia de protección de datos personales, la privacidad de los usuarios y el secreto y seguridad de los datos personales, en concreto el Reglamento 2016/679 del Parlamento Europeo y del Consejo de 27 de abril de 2016, adoptando para ello las medidas técnicas y organizativas necesarias para evitar la pérdida, mal uso, alteración, acceso no autorizado y robo de los datos personales facilitados, habida cuenta del estado de la tecnología, la naturaleza de los datos y los riesgos a los que están expuestos.
      </p>

      <p className="text-muted-foreground leading-relaxed">
        De acuerdo con la actual legislación, el Titular queda informado y, si es mayor de 14 años, otorga su consentimiento expreso para el tratamiento de sus datos personales con la finalidad descrita a continuación. Si el Titular es menor de 14 años, dicho consentimiento expreso es otorgado por su padre, madre o tutor legal.
      </p>

      {/* Table 1: Data Protection Information */}
      <h4 className="text-center font-semibold bg-muted py-2 rounded">
        Información sobre protección de datos
      </h4>
      <table className="w-full border border-border text-sm">
        <tbody>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Responsable del tratamiento
            </th>
            <td className="p-3">Asociación Power to Code</td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Finalidad del Tratamiento
            </th>
            <td className="p-3">
              Gestionar su participación en el evento y/o taller organizado por Power to Code, así como el envío de invitaciones y convocatorias a los mismos. Power to Code, como entidad sin ánimo de lucro y dentro del desarrollo de sus fines fundacionales, le mantendrá informado de su actividad relativa al evento. Participar en este evento conlleva la cesión de derechos de imagen (*).
            </td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Legitimación
            </th>
            <td className="p-3">Consentimiento del Titular</td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Cesiones
            </th>
            <td className="p-3">
              No se realizan cesiones a terceros, excepto para la publicación de imágenes conforme se detalla a continuación.
            </td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Derechos
            </th>
            <td className="p-3">
              A retirar su consentimiento en cualquier momento, a oponerse al tratamiento, a acceder, rectificar y suprimir los datos, así como otros derechos, tal y como se explica en la información adicional.
            </td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Transferencias Internacionales
            </th>
            <td className="p-3">No se realizarán transferencias internacionales de datos</td>
          </tr>
          <tr>
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Información adicional
            </th>
            <td className="p-3">
              <a
                href="https://powertocode.org/privacy-policy/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                https://powertocode.org/privacy-policy/
              </a>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Table 2: Image Treatment Information */}
      <h4 className="text-center font-semibold bg-muted py-2 rounded mt-6">
        (*) Información específica sobre el tratamiento de imágenes
      </h4>
      <table className="w-full border border-border text-sm">
        <tbody>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Responsable
            </th>
            <td className="p-3">
              Asociación Power to Code con NIF G-88095351 (en adelante "Power to Code") y domicilio en Plaza de Segovia 5, 28600, Navalcarnero, Madrid
            </td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Soportes
            </th>
            <td className="p-3">
              Fotografías, vídeos, vídeos con voz, material gráfico, etc., o parte de las mismas en las que interviene o ha intervenido el Titular en el marco de los proyectos de Power to Code
            </td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Ámbito de Utilización
            </th>
            <td className="p-3">
              No se circunscribe a un ámbito temporal o territorial determinados, por lo que Power to Code podrá utilizar estas Imágenes, o parte de las mismas, en todos los países del mundo sin limitación geográfica de ninguna clase y con la máxima extensión temporal permitida en la legislación vigente.
            </td>
          </tr>
          <tr className="border-b border-border">
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Cesiones
            </th>
            <td className="p-3">
              Exclusivamente con carácter social y nunca comercial, Power to Code podrá ceder a terceros, tales como entidades colaboradoras o patrocinadores, las imágenes, o parte de las mismas, en las que el Titular aparece como modelo, entrevistado, narrador o participante principal o secundario en el ámbito (sea cual fuere el medio de comunicación interno o externo) y finalidades de los proyectos de Power to Code.
              <br /><br />
              El objeto de la cesión será la promoción de las actividades de Power to Code, en medios de comunicación internos o externos a la misma, para que puedan ser difundidas en todos los medios de comunicación conocidos en la actualidad incluidos los online (Youtube, Linkedin, Instagram, Tik Tok Facebook, etc), streaming y los que pudieran desarrollarse en el futuro. Todo ello con la única salvedad y limitación de aquellas utilizaciones o aplicaciones que pudieran atentar al derecho al honor, a la moral y/o al orden público, en los términos previstos en la legislación vigente en cada país.
            </td>
          </tr>
          <tr>
            <th className="w-1/3 p-3 bg-muted text-left font-semibold align-top border-r border-border">
              Términos de la cesión
            </th>
            <td className="p-3">
              El Titular acepta que la cesión del uso de su imagen que se desprenda de la toma de fotografías y filmación de videos durante las actividades de Power to Code, la realiza a favor de esta con carácter gratuito. Power to Code se exime de responsabilidad sobre cualquier uso que pueda hacer un tercero de las Imágenes fuera del ámbito territorial, temporal y material objeto del presente acuerdo.
            </td>
          </tr>
        </tbody>
      </table>

      {/* Final paragraphs */}
      <p className="text-muted-foreground leading-relaxed mt-4">
        El padre/madre o tutor legal del Titular, o el Titular, cuyo nombre y apellidos figuran a continuación, será el único responsable de la veracidad y exactitud de los datos facilitados a Power to Code.
      </p>
      <p className="text-muted-foreground leading-relaxed">
        El padre, madre o tutor legal del Titular, o el Titular, declara que ha leído, entiende y autoriza expresamente el tratamiento de sus datos de carácter personal al haber sacado una entrada para el evento <strong>{eventName}</strong> que se celebrará el <strong>{eventDate}</strong>{eventLocation && <> en <strong>{eventLocation}</strong></>} y que cancela su entrada en caso de no autorizar el mencionado tratamiento de sus datos de carácter personal.
      </p>

      {signerName && (
        <p className="text-muted-foreground leading-relaxed">
          Nombre y apellidos del Padre/Madre o Tutor legal (o del Titular para mayores de 14 años): <strong>{signerName}</strong>
        </p>
      )}
    </div>
  );
}
