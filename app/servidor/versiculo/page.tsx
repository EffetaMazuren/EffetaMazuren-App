'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

const VERSICULOS = [
  { ref: 'Génesis 1:1', texto: 'En el principio creó Dios los cielos y la tierra.' },
  { ref: 'Génesis 1:31', texto: 'Y vio Dios todo lo que había hecho, y he aquí que era bueno en gran manera.' },
  { ref: 'Éxodo 14:14', texto: 'El Señor peleará por vosotros, y vosotros estaréis tranquilos.' },
  { ref: 'Éxodo 33:14', texto: 'Mi presencia irá contigo, y te daré descanso.' },
  { ref: 'Levítico 19:18', texto: 'Amarás a tu prójimo como a ti mismo. Yo soy el Señor.' },
  { ref: 'Números 6:24-26', texto: 'El Señor te bendiga y te guarde; el Señor haga resplandecer su rostro sobre ti, y tenga de ti misericordia.' },
  { ref: 'Deuteronomio 6:5', texto: 'Y amarás al Señor tu Dios de todo tu corazón, y de toda tu alma, y con todas tus fuerzas.' },
  { ref: 'Deuteronomio 31:6', texto: 'Esforzaos y cobrad ánimo; no temáis, ni tengáis miedo de ellos; porque el Señor tu Dios es el que va contigo.' },
  { ref: 'Josué 1:9', texto: 'Mira que te mando que te esfuerces y seas valiente; no temas ni desmayes, porque el Señor tu Dios estará contigo en dondequiera que vayas.' },
  { ref: 'Josué 24:15', texto: 'Yo y mi casa serviremos al Señor.' },
  { ref: 'Rut 1:16', texto: 'Tu pueblo será mi pueblo, y tu Dios mi Dios.' },
  { ref: '1 Samuel 16:7', texto: 'El Señor no mira lo que mira el hombre; pues el hombre mira lo que está delante de sus ojos, pero el Señor mira el corazón.' },
  { ref: '2 Samuel 22:2', texto: 'El Señor es mi roca y mi fortaleza, y mi libertador.' },
  { ref: '1 Reyes 8:56', texto: 'No ha faltado una palabra de todas sus promesas que expresó por medio de Moisés su siervo.' },
  { ref: '1 Crónicas 16:34', texto: 'Alabad al Señor, porque él es bueno; porque su misericordia es eterna.' },
  { ref: '2 Crónicas 7:14', texto: 'Si se humillare mi pueblo, sobre el cual mi nombre es invocado, y oraren, y buscaren mi rostro, y se convirtieren de sus malos caminos; entonces yo oiré desde los cielos, y perdonaré sus pecados.' },
  { ref: 'Nehemías 8:10', texto: 'El gozo del Señor es vuestra fuerza.' },
  { ref: 'Ester 4:14', texto: '¿Y quién sabe si para esta hora has llegado al reino?' },
  { ref: 'Job 19:25', texto: 'Yo sé que mi Redentor vive.' },
  { ref: 'Job 23:10', texto: 'Mas él conoce mi camino; me probará, y saldré como oro.' },
  { ref: 'Salmos 1:1-2', texto: 'Bienaventurado el varón que no anduvo en consejo de malos... antes en la ley del Señor está su delicia, y en su ley medita de día y de noche.' },
  { ref: 'Salmos 4:8', texto: 'En paz me acostaré, y asimismo dormiré; porque solo tú, Señor, me haces vivir confiado.' },
  { ref: 'Salmos 16:8', texto: 'A el Señor he puesto siempre delante de mí; porque está a mi diestra, no seré movido.' },
  { ref: 'Salmos 19:14', texto: 'Sean gratos los dichos de mi boca y la meditación de mi corazón delante de ti, oh Señor, roca mía, y redentor mío.' },
  { ref: 'Salmos 23:1', texto: 'El Señor es mi pastor; nada me faltará.' },
  { ref: 'Salmos 23:4', texto: 'Aunque ande en valle de sombra de muerte, no temeré mal alguno, porque tú estarás conmigo.' },
  { ref: 'Salmos 27:1', texto: 'El Señor es mi luz y mi salvación; ¿de quién temeré?' },
  { ref: 'Salmos 27:14', texto: 'Aguarda al Señor; esfuérzate, y aliéntese tu corazón; sí, espera al Señor.' },
  { ref: 'Salmos 28:7', texto: 'El Señor es mi fortaleza y mi escudo; en él confió mi corazón, y fui ayudado.' },
  { ref: 'Salmos 29:11', texto: 'El Señor dará fortaleza a su pueblo; el Señor bendecirá a su pueblo con paz.' },
  { ref: 'Salmos 30:5', texto: 'Por la noche durará el lloro, y a la mañana vendrá la alegría.' },
  { ref: 'Salmos 31:15', texto: 'En tu mano están mis tiempos.' },
  { ref: 'Salmos 32:8', texto: 'Te haré entender, y te enseñaré el camino en que debes andar; sobre ti fijaré mis ojos.' },
  { ref: 'Salmos 34:8', texto: 'Gustad, y ved que es bueno el Señor; dichoso el hombre que confía en él.' },
  { ref: 'Salmos 34:18', texto: 'Cercano está el Señor a los quebrantados de corazón; y salva a los contritos de espíritu.' },
  { ref: 'Salmos 37:4', texto: 'Deléitate asimismo en el Señor, y él te concederá las peticiones de tu corazón.' },
  { ref: 'Salmos 37:5', texto: 'Encomienda al Señor tu camino, y confía en él; y él hará.' },
  { ref: 'Salmos 40:8', texto: 'El hacer tu voluntad, Dios mío, me ha agradado.' },
  { ref: 'Salmos 42:1', texto: 'Como el ciervo brama por las corrientes de las aguas, así clama por ti, oh Dios, el alma mía.' },
  { ref: 'Salmos 46:1', texto: 'Dios es nuestro amparo y fortaleza, nuestro pronto auxilio en las tribulaciones.' },
  { ref: 'Salmos 46:10', texto: 'Estad quietos, y conoced que yo soy Dios.' },
  { ref: 'Salmos 51:10', texto: 'Crea en mí, oh Dios, un corazón limpio, y renueva un espíritu recto dentro de mí.' },
  { ref: 'Salmos 55:22', texto: 'Echa sobre el Señor tu carga, y él te sustentará; no dejará para siempre caído al justo.' },
  { ref: 'Salmos 62:1', texto: 'Solo en Dios descansa el alma mía; de él viene mi salvación.' },
  { ref: 'Salmos 63:3', texto: 'Porque mejor es tu misericordia que la vida; mis labios te alabarán.' },
  { ref: 'Salmos 73:26', texto: 'Mi carne y mi corazón desfallecen; mas la roca de mi corazón y mi porción es Dios para siempre.' },
  { ref: 'Salmos 86:5', texto: 'Porque tú, Señor, eres bueno y perdonador, y grande en misericordia para con todos los que te invocan.' },
  { ref: 'Salmos 90:12', texto: 'Enséñanos de tal modo a contar nuestros días, que traigamos al corazón sabiduría.' },
  { ref: 'Salmos 91:1', texto: 'El que habita al abrigo del Altísimo morará bajo la sombra del Omnipotente.' },
  { ref: 'Salmos 91:2', texto: 'Diré yo al Señor: Esperanza mía, y castillo mío; mi Dios, en quien confiaré.' },
  { ref: 'Salmos 91:11', texto: 'Pues a sus ángeles mandará acerca de ti, que te guarden en todos tus caminos.' },
  { ref: 'Salmos 100:3', texto: 'Reconoced que el Señor es Dios; él nos hizo, y no nosotros a nosotros mismos.' },
  { ref: 'Salmos 103:2', texto: 'Bendice, alma mía, al Señor, y no olvides ninguno de sus beneficios.' },
  { ref: 'Salmos 103:12', texto: 'Cuanto está lejos el oriente del occidente, hizo alejar de nosotros nuestras rebeliones.' },
  { ref: 'Salmos 107:1', texto: 'Alabad al Señor, porque él es bueno; porque para siempre es su misericordia.' },
  { ref: 'Salmos 118:24', texto: 'Este es el día que hizo el Señor; nos gozaremos y alegraremos en él.' },
  { ref: 'Salmos 119:11', texto: 'En mi corazón he guardado tus dichos, para no pecar contra ti.' },
  { ref: 'Salmos 119:105', texto: 'Lámpara es a mis pies tu palabra, y lumbrera a mi camino.' },
  { ref: 'Salmos 121:1-2', texto: 'Alzaré mis ojos a los montes; ¿de dónde vendrá mi socorro? Mi socorro viene del Señor, que hizo los cielos y la tierra.' },
  { ref: 'Salmos 121:8', texto: 'El Señor guardará tu salida y tu entrada desde ahora y para siempre.' },
  { ref: 'Salmos 127:1', texto: 'Si el Señor no edificare la casa, en vano trabajan los que la edifican.' },
  { ref: 'Salmos 139:13', texto: 'Porque tú formaste mis entrañas; tú me hiciste en el vientre de mi madre.' },
  { ref: 'Salmos 139:14', texto: 'Te alabaré; porque formidables, maravillosas son tus obras; estoy maravillado, y mi alma lo sabe muy bien.' },
  { ref: 'Salmos 143:8', texto: 'Hazme oír por la mañana tu misericordia, porque en ti he confiado.' },
  { ref: 'Salmos 145:18', texto: 'Cercano está el Señor a todos los que le invocan, a todos los que le invocan de veras.' },
  { ref: 'Proverbios 3:5', texto: 'Fíate del Señor de todo tu corazón, y no te apoyes en tu propia prudencia.' },
  { ref: 'Proverbios 3:6', texto: 'Reconócelo en todos tus caminos, y él enderezará tus veredas.' },
  { ref: 'Proverbios 4:23', texto: 'Sobre toda cosa guardada, guarda tu corazón; porque de él mana la vida.' },
  { ref: 'Proverbios 11:25', texto: 'El alma generosa será prosperada; y el que saciare, él también será saciado.' },
  { ref: 'Proverbios 16:3', texto: 'Encomienda al Señor tus obras, y tus pensamientos serán afirmados.' },
  { ref: 'Proverbios 16:9', texto: 'El corazón del hombre piensa su camino; mas el Señor endereza sus pasos.' },
  { ref: 'Proverbios 17:17', texto: 'En todo tiempo ama el amigo, y es como un hermano en tiempo de angustia.' },
  { ref: 'Proverbios 18:10', texto: 'Torre fuerte es el nombre del Señor; a él correrá el justo, y será levantado.' },
  { ref: 'Proverbios 19:21', texto: 'Muchos pensamientos hay en el corazón del hombre; mas el consejo del Señor permanecerá.' },
  { ref: 'Proverbios 22:1', texto: 'De más estima es el buen nombre que las muchas riquezas.' },
  { ref: 'Proverbios 27:17', texto: 'Hierro con hierro se aguza; y así el hombre aguza el rostro de su amigo.' },
  { ref: 'Eclesiastés 3:1', texto: 'Todo tiene su tiempo, y todo lo que se quiere debajo del cielo tiene su hora.' },
  { ref: 'Eclesiastés 4:9', texto: 'Mejores son dos que uno; porque tienen mejor paga de su trabajo.' },
  { ref: 'Cantar de los Cantares 2:4', texto: 'Me llevó a la casa del banquete, y su bandera sobre mí fue amor.' },
  { ref: 'Isaías 6:8', texto: 'Entonces oí la voz del Señor, que decía: ¿A quién enviaré, y quién irá por nosotros? Y respondí yo: Heme aquí, envíame a mí.' },
  { ref: 'Isaías 9:6', texto: 'Porque un niño nos es nacido, hijo nos es dado, y el principado sobre su hombro; y se llamará su nombre Admirable, Consejero, Dios Fuerte, Padre Eterno, Príncipe de Paz.' },
  { ref: 'Isaías 26:3', texto: 'Tú guardarás en completa paz a aquel cuyo pensamiento en ti persevera; porque en ti ha confiado.' },
  { ref: 'Isaías 30:18', texto: 'Bienaventurados todos los que confían en él.' },
  { ref: 'Isaías 40:8', texto: 'Sécase la hierba, marchítase la flor; mas la palabra del Dios nuestro permanece para siempre.' },
  { ref: 'Isaías 40:28', texto: 'El Señor es el Dios eterno, creador de los confines de la tierra. No se cansa ni se fatiga.' },
  { ref: 'Isaías 40:29', texto: 'Él da esfuerzo al cansado, y multiplica las fuerzas al que no tiene ningunas.' },
  { ref: 'Isaías 40:31', texto: 'Pero los que esperan en el Señor renovarán sus fuerzas; levantarán alas como las águilas; correrán, y no se cansarán; caminarán, y no se fatigarán.' },
  { ref: 'Isaías 41:10', texto: 'No temas, porque yo estoy contigo; no desmayes, porque yo soy tu Dios que te esfuerzo; siempre te ayudaré, siempre te sustentaré con la diestra de mi justicia.' },
  { ref: 'Isaías 43:1', texto: 'No temas, porque yo te redimí; te puse nombre, mío eres tú.' },
  { ref: 'Isaías 43:2', texto: 'Cuando pases por las aguas, yo estaré contigo; y si por los ríos, no te anegarán.' },
  { ref: 'Isaías 43:19', texto: 'He aquí que yo hago cosa nueva; pronto saldrá a luz; ¿no la conoceréis?' },
  { ref: 'Isaías 46:4', texto: 'Y hasta la vejez yo mismo, y hasta las canas os soportaré yo; yo hice, yo llevaré, yo soportaré y guardaré.' },
  { ref: 'Isaías 48:17', texto: 'Así ha dicho el Señor, Redentor tuyo, el Santo de Israel: Yo soy el Señor Dios tuyo, que te enseña provechosamente.' },
  { ref: 'Isaías 49:15', texto: 'Antes que olvidarme yo de ti, ¿podrá una mujer olvidar a su niño de pecho? Pues aunque éstas se olvidasen, yo nunca me olvidaré de ti.' },
  { ref: 'Isaías 53:5', texto: 'Mas él herido fue por nuestras rebeliones, molido por nuestros pecados; el castigo de nuestra paz fue sobre él, y por su llaga fuimos nosotros curados.' },
  { ref: 'Isaías 54:10', texto: 'Porque los montes se moverán, y los collados temblarán, pero no se apartará de ti mi misericordia.' },
  { ref: 'Isaías 55:8', texto: 'Porque mis pensamientos no son vuestros pensamientos, ni vuestros caminos mis caminos, dijo el Señor.' },
  { ref: 'Isaías 58:11', texto: 'El Señor te pastoreará siempre, y en las sequías saciará tu alma, y engordará tus huesos; y serás como huerto de riego, y como manadero de aguas, cuyas aguas nunca faltan.' },
  { ref: 'Isaías 60:1', texto: 'Levántate, resplandece; porque ha venido tu luz, y la gloria del Señor ha nacido sobre ti.' },
  { ref: 'Isaías 61:1', texto: 'El Espíritu del Señor el Señor está sobre mí, porque me ungió el Señor; me ha enviado a predicar buenas nuevas a los abatidos.' },
  { ref: 'Jeremías 17:7', texto: 'Bendito el varón que confía en el Señor, y cuya confianza es el Señor.' },
  { ref: 'Jeremías 29:11', texto: 'Porque yo sé los pensamientos que tengo acerca de vosotros, dice el Señor, pensamientos de paz, y no de mal, para daros el fin que esperáis.' },
  { ref: 'Jeremías 29:13', texto: 'Y me buscaréis y me hallaréis, porque me buscaréis de todo vuestro corazón.' },
  { ref: 'Jeremías 31:3', texto: 'Con amor eterno te he amado; por tanto, te prolongué mi misericordia.' },
  { ref: 'Jeremías 33:3', texto: 'Clama a mí, y yo te responderé, y te enseñaré cosas grandes y ocultas que tú no conoces.' },
  { ref: 'Lamentaciones 3:22-23', texto: 'Las misericordias del Señor nunca se acaban; porque nunca decayeron sus bondades. Nuevas son cada mañana; grande es tu fidelidad.' },
  { ref: 'Ezequiel 36:26', texto: 'Os daré corazón nuevo, y pondré espíritu nuevo dentro de vosotros.' },
  { ref: 'Daniel 3:17', texto: 'He aquí nuestro Dios a quien servimos puede librarnos del horno de fuego ardiendo.' },
  { ref: 'Oseas 6:3', texto: 'Y conoceremos, y proseguiremos en conocer al Señor; como el alba está dispuesta su salida.' },
  { ref: 'Joel 2:28', texto: 'Y después de esto derramaré mi Espíritu sobre toda carne, y profetizarán vuestros hijos y vuestras hijas.' },
  { ref: 'Amós 5:24', texto: 'Pero corra el juicio como las aguas, y la justicia como impetuoso arroyo.' },
  { ref: 'Miqueas 6:8', texto: 'Oh hombre, él te ha declarado lo que es bueno, y qué pide el Señor de ti: solamente hacer justicia, y amar misericordia, y humillarte ante tu Dios.' },
  { ref: 'Habacuc 2:4', texto: 'El justo por su fe vivirá.' },
  { ref: 'Sofonías 3:17', texto: 'El Señor está en medio de ti, poderoso, él salvará; se gozará sobre ti con alegría, callará de amor, se regocijará sobre ti con cánticos.' },
  { ref: 'Hageo 2:4', texto: 'Pues ahora, esfuérzate, Zorobabel, dice el Señor; esfuérzate también, Josué; y cobrad ánimo, pueblo todo de la tierra, dice el Señor, y trabajad.' },
  { ref: 'Zacarías 4:6', texto: 'No con ejército, ni con fuerza, sino con mi Espíritu, ha dicho el Señor de los ejércitos.' },
  { ref: 'Malaquías 3:10', texto: 'Traed todos los diezmos al alfolí y haya alimento en mi casa; y probadme ahora en esto, dice el Señor de los ejércitos.' },
  { ref: 'Mateo 5:3', texto: 'Bienaventurados los pobres en espíritu, porque de ellos es el reino de los cielos.' },
  { ref: 'Mateo 5:6', texto: 'Bienaventurados los que tienen hambre y sed de justicia, porque ellos serán saciados.' },
  { ref: 'Mateo 5:8', texto: 'Bienaventurados los de limpio corazón, porque ellos verán a Dios.' },
  { ref: 'Mateo 5:9', texto: 'Bienaventurados los pacificadores, porque ellos serán llamados hijos de Dios.' },
  { ref: 'Mateo 5:16', texto: 'Así alumbre vuestra luz delante de los hombres, para que vean vuestras buenas obras, y glorifiquen a vuestro Padre que está en los cielos.' },
  { ref: 'Mateo 6:33', texto: 'Mas buscad primeramente el reino de Dios y su justicia, y todas estas cosas os serán añadidas.' },
  { ref: 'Mateo 7:7', texto: 'Pedid, y se os dará; buscad, y hallaréis; llamad, y se os abrirá.' },
  { ref: 'Mateo 11:28', texto: 'Venid a mí todos los que estáis trabajados y cargados, y yo os haré descansar.' },
  { ref: 'Mateo 11:29', texto: 'Llevad mi yugo sobre vosotros, y aprended de mí, que soy manso y humilde de corazón; y hallaréis descanso para vuestras almas.' },
  { ref: 'Mateo 19:26', texto: 'Para los hombres esto es imposible; mas para Dios todo es posible.' },
  { ref: 'Mateo 22:37-38', texto: 'Amarás al Señor tu Dios con todo tu corazón, y con toda tu alma, y con toda tu mente. Éste es el primero y grande mandamiento.' },
  { ref: 'Mateo 28:19', texto: 'Id, y haced discípulos a todas las naciones, bautizándoles en el nombre del Padre, y del Hijo, y del Espíritu Santo.' },
  { ref: 'Mateo 28:20', texto: 'Y he aquí yo estoy con vosotros todos los días, hasta el fin del mundo.' },
  { ref: 'Marcos 9:23', texto: 'Si puedes creer, al que cree todo le es posible.' },
  { ref: 'Marcos 10:45', texto: 'Porque el Hijo del Hombre no vino para ser servido, sino para servir, y para dar su vida en rescate por muchos.' },
  { ref: 'Marcos 11:24', texto: 'Por tanto, os digo que todo lo que pidiereis orando, creed que lo recibiréis, y os vendrá.' },
  { ref: 'Lucas 1:37', texto: 'Porque nada hay imposible para Dios.' },
  { ref: 'Lucas 1:45', texto: 'Bienaventurada la que creyó, porque se cumplirá lo que le fue dicho de parte del Señor.' },
  { ref: 'Lucas 6:27', texto: 'Amad a vuestros enemigos, haced bien a los que os aborrecen.' },
  { ref: 'Lucas 6:31', texto: 'Y como queréis que hagan los hombres con vosotros, así también haced vosotros con ellos.' },
  { ref: 'Lucas 10:27', texto: 'Amarás al Señor tu Dios con todo tu corazón, y con toda tu alma, y con todas tus fuerzas, y con toda tu mente; y a tu prójimo como a ti mismo.' },
  { ref: 'Lucas 15:24', texto: 'Porque este mi hijo muerto era, y ha revivido; se había perdido, y es hallado.' },
  { ref: 'Lucas 17:21', texto: 'El reino de Dios está entre vosotros.' },
  { ref: 'Juan 1:1', texto: 'En el principio era el Verbo, y el Verbo era con Dios, y el Verbo era Dios.' },
  { ref: 'Juan 1:14', texto: 'Y aquel Verbo fue hecho carne, y habitó entre nosotros (y vimos su gloria, gloria como del unigénito del Padre), lleno de gracia y de verdad.' },
  { ref: 'Juan 3:16', texto: 'Porque de tal manera amó Dios al mundo, que ha dado a su Hijo unigénito, para que todo aquel que en él cree, no se pierda, mas tenga vida eterna.' },
  { ref: 'Juan 3:17', texto: 'Porque no envió Dios a su Hijo al mundo para condenar al mundo, sino para que el mundo sea salvo por él.' },
  { ref: 'Juan 8:12', texto: 'Yo soy la luz del mundo; el que me sigue, no andará en tinieblas, sino que tendrá la luz de la vida.' },
  { ref: 'Juan 10:10', texto: 'Yo he venido para que tengan vida, y para que la tengan en abundancia.' },
  { ref: 'Juan 10:27', texto: 'Mis ovejas oyen mi voz, y yo las conozco, y me siguen.' },
  { ref: 'Juan 11:25', texto: 'Yo soy la resurrección y la vida; el que cree en mí, aunque esté muerto, vivirá.' },
  { ref: 'Juan 13:34', texto: 'Un mandamiento nuevo os doy: Que os améis unos a otros; como yo os he amado, que también os améis unos a otros.' },
  { ref: 'Juan 13:35', texto: 'En esto conocerán todos que sois mis discípulos, si tuviereis amor los unos con los otros.' },
  { ref: 'Juan 14:1', texto: 'No se turbe vuestro corazón; creéis en Dios, creed también en mí.' },
  { ref: 'Juan 14:6', texto: 'Yo soy el camino, y la verdad, y la vida; nadie viene al Padre, sino por mí.' },
  { ref: 'Juan 14:16', texto: 'Y yo rogaré al Padre, y os dará otro Consolador, para que esté con vosotros para siempre.' },
  { ref: 'Juan 14:27', texto: 'La paz os dejo, mi paz os doy; yo no os la doy como el mundo la da. No se turbe vuestro corazón, ni tenga miedo.' },
  { ref: 'Juan 15:4', texto: 'Permaneced en mí, y yo en vosotros. Como el pámpano no puede llevar fruto por sí mismo, si no permanece en la vid, así tampoco vosotros, si no permanecéis en mí.' },
  { ref: 'Juan 15:5', texto: 'Yo soy la vid, vosotros los pámpanos; el que permanece en mí, y yo en él, éste lleva mucho fruto; porque separados de mí nada podéis hacer.' },
  { ref: 'Juan 15:12', texto: 'Este es mi mandamiento: Que os améis unos a otros, como yo os he amado.' },
  { ref: 'Juan 15:13', texto: 'Nadie tiene mayor amor que este, que uno ponga su vida por sus amigos.' },
  { ref: 'Juan 16:33', texto: 'En el mundo tendréis aflicción; pero confiad, yo he vencido al mundo.' },
  { ref: 'Hechos 1:8', texto: 'Pero recibiréis poder, cuando haya venido sobre vosotros el Espíritu Santo, y me seréis testigos en Jerusalén, en toda Judea, en Samaria, y hasta lo último de la tierra.' },
  { ref: 'Hechos 2:28', texto: 'Me hiciste conocer los caminos de la vida; me llenarás de gozo con tu presencia.' },
  { ref: 'Hechos 4:12', texto: 'Y en ningún otro hay salvación; porque no hay otro nombre bajo el cielo, dado a los hombres, en que podamos ser salvos.' },
  { ref: 'Romanos 1:16', texto: 'Porque no me avergüenzo del evangelio, porque es poder de Dios para salvación a todo aquel que cree.' },
  { ref: 'Romanos 3:23', texto: 'Por cuanto todos pecaron, y están destituidos de la gloria de Dios.' },
  { ref: 'Romanos 5:1', texto: 'Justificados, pues, por la fe, tenemos paz para con Dios por medio de nuestro Señor Jesucristo.' },
  { ref: 'Romanos 5:8', texto: 'Mas Dios muestra su amor para con nosotros, en que siendo aún pecadores, Cristo murió por nosotros.' },
  { ref: 'Romanos 6:23', texto: 'Porque la paga del pecado es muerte, mas la dádiva de Dios es vida eterna en Cristo Jesús Señor nuestro.' },
  { ref: 'Romanos 8:1', texto: 'Ahora, pues, ninguna condenación hay para los que están en Cristo Jesús.' },
  { ref: 'Romanos 8:28', texto: 'Y sabemos que a los que aman a Dios, todas las cosas les ayudan a bien, esto es, a los que conforme a su propósito son llamados.' },
  { ref: 'Romanos 8:31', texto: 'Si Dios es por nosotros, ¿quién contra nosotros?' },
  { ref: 'Romanos 8:37', texto: 'Antes, en todas estas cosas somos más que vencedores por medio de aquel que nos amó.' },
  { ref: 'Romanos 8:38-39', texto: 'Por lo cual estoy seguro de que ni la muerte, ni la vida, ni ángeles, ni principados, ni potestades, ni lo presente, ni lo por venir... nos podrá separar del amor de Dios.' },
  { ref: 'Romanos 10:9', texto: 'Si confesares con tu boca que Jesús es el Señor, y creyeres en tu corazón que Dios le levantó de los muertos, serás salvo.' },
  { ref: 'Romanos 12:1', texto: 'Así que, hermanos, os ruego por las misericordias de Dios, que presentéis vuestros cuerpos en sacrificio vivo, santo, agradable a Dios, que es vuestro culto racional.' },
  { ref: 'Romanos 12:2', texto: 'No os conforméis a este siglo, sino transformaos por medio de la renovación de vuestro entendimiento.' },
  { ref: 'Romanos 12:10', texto: 'Amaos los unos a los otros con amor fraternal; en cuanto a honra, prefiriéndoos los unos a los otros.' },
  { ref: 'Romanos 12:12', texto: 'Gozosos en la esperanza; sufridos en la tribulación; constantes en la oración.' },
  { ref: 'Romanos 12:21', texto: 'No seas vencido de lo malo, sino vence con el bien el mal.' },
  { ref: 'Romanos 15:13', texto: 'Y el Dios de esperanza os llene de todo gozo y paz en el creer, para que abundéis en esperanza por el poder del Espíritu Santo.' },
  { ref: '1 Corintios 10:13', texto: 'No os ha sobrevenido ninguna tentación que no sea humana; pero fiel es Dios, que no os dejará ser tentados más de lo que podéis resistir.' },
  { ref: '1 Corintios 13:4', texto: 'El amor es sufrido, es benigno; el amor no tiene envidia, el amor no es jactancioso, no se envanece.' },
  { ref: '1 Corintios 13:7', texto: 'Todo lo sufre, todo lo cree, todo lo espera, todo lo soporta.' },
  { ref: '1 Corintios 13:13', texto: 'Y ahora permanecen la fe, la esperanza y el amor, estos tres; pero el mayor de ellos es el amor.' },
  { ref: '1 Corintios 15:57', texto: 'Mas gracias sean dadas a Dios, que nos da la victoria por medio de nuestro Señor Jesucristo.' },
  { ref: '1 Corintios 16:14', texto: 'Todas vuestras cosas sean hechas con amor.' },
  { ref: '2 Corintios 1:3', texto: 'Bendito sea el Dios y Padre de nuestro Señor Jesucristo, Padre de misericordias y Dios de toda consolación.' },
  { ref: '2 Corintios 4:17', texto: 'Porque esta leve tribulación momentánea produce en nosotros un cada vez más excelente y eterno peso de gloria.' },
  { ref: '2 Corintios 5:7', texto: 'Porque por fe andamos, no por vista.' },
  { ref: '2 Corintios 5:17', texto: 'De modo que si alguno está en Cristo, nueva criatura es; las cosas viejas pasaron; he aquí todas son hechas nuevas.' },
  { ref: '2 Corintios 9:7', texto: 'Cada uno dé como propuso en su corazón: no con tristeza, ni por necesidad, porque Dios ama al dador alegre.' },
  { ref: '2 Corintios 12:9', texto: 'Y me ha dicho: Bástate mi gracia; porque mi poder se perfecciona en la debilidad.' },
  { ref: 'Gálatas 2:20', texto: 'Con Cristo estoy juntamente crucificado, y ya no vivo yo, mas vive Cristo en mí.' },
  { ref: 'Gálatas 5:22', texto: 'Mas el fruto del Espíritu es amor, gozo, paz, paciencia, benignidad, bondad, fe, mansedumbre, templanza.' },
  { ref: 'Gálatas 6:2', texto: 'Sobrellevad los unos las cargas de los otros, y cumplid así la ley de Cristo.' },
  { ref: 'Gálatas 6:9', texto: 'No nos cansemos, pues, de hacer bien; porque a su tiempo segaremos, si no desmayamos.' },
  { ref: 'Efesios 2:8', texto: 'Porque por gracia sois salvos por medio de la fe; y esto no de vosotros, pues es don de Dios.' },
  { ref: 'Efesios 2:10', texto: 'Porque somos hechura suya, creados en Cristo Jesús para buenas obras.' },
  { ref: 'Efesios 3:20', texto: 'Y a Aquel que es poderoso para hacer todas las cosas mucho más abundantemente de lo que pedimos o entendemos, según el poder que actúa en nosotros.' },
  { ref: 'Efesios 4:2', texto: 'Con toda humildad y mansedumbre, soportándoos con paciencia los unos a los otros en amor.' },
  { ref: 'Efesios 4:32', texto: 'Antes sed benignos unos con otros, misericordiosos, perdonándoos unos a otros, como Dios también os perdonó en Cristo.' },
  { ref: 'Efesios 5:2', texto: 'Y andad en amor, como también Cristo nos amó, y se entregó a sí mismo por nosotros, ofrenda y sacrificio a Dios en olor fragante.' },
  { ref: 'Efesios 6:11', texto: 'Vestíos de toda la armadura de Dios, para que podáis estar firmes contra las asechanzas del diablo.' },
  { ref: 'Filipenses 1:6', texto: 'Estando persuadido de esto, que el que comenzó en vosotros la buena obra, la perfeccionará hasta el día de Jesucristo.' },
  { ref: 'Filipenses 2:3', texto: 'Nada hagáis por contienda o por vanagloria; antes bien con humildad, estimando cada uno a los demás como superiores a él mismo.' },
  { ref: 'Filipenses 2:4', texto: 'No mirando cada uno a lo suyo propio, sino cada cual también a lo de los otros.' },
  { ref: 'Filipenses 3:14', texto: 'Prosigo a la meta, al premio del supremo llamamiento de Dios en Cristo Jesús.' },
  { ref: 'Filipenses 4:4', texto: 'Regocijaos en el Señor siempre. Otra vez digo: ¡Regocijaos!' },
  { ref: 'Filipenses 4:6', texto: 'Por nada estéis afanosos, sino sean conocidas vuestras peticiones delante de Dios en toda oración y ruego, con acción de gracias.' },
  { ref: 'Filipenses 4:7', texto: 'Y la paz de Dios, que sobrepasa todo entendimiento, guardará vuestros corazones y vuestros pensamientos en Cristo Jesús.' },
  { ref: 'Filipenses 4:13', texto: 'Todo lo puedo en Cristo que me fortalece.' },
  { ref: 'Colosenses 1:17', texto: 'Y él es antes de todas las cosas, y todas las cosas en él subsisten.' },
  { ref: 'Colosenses 3:12', texto: 'Vestíos, pues, como escogidos de Dios, santos y amados, de entrañable misericordia, de benignidad, de humildad, de mansedumbre, de paciencia.' },
  { ref: 'Colosenses 3:14', texto: 'Y sobre todas estas cosas vestíos de amor, que es el vínculo perfecto.' },
  { ref: 'Colosenses 3:17', texto: 'Y todo lo que hacéis, sea de palabra o de hecho, hacedlo todo en el nombre del Señor Jesús, dando gracias a Dios Padre por medio de él.' },
  { ref: '1 Tesalonicenses 5:16-18', texto: 'Estad siempre gozosos. Orad sin cesar. Dad gracias en todo, porque esta es la voluntad de Dios para con vosotros en Cristo Jesús.' },
  { ref: '2 Timoteo 1:7', texto: 'Porque no nos ha dado Dios espíritu de cobardía, sino de poder, de amor y de dominio propio.' },
  { ref: '2 Timoteo 3:16', texto: 'Toda la Escritura es inspirada por Dios, y útil para enseñar, para redargüir, para corregir, para instruir en justicia.' },
  { ref: 'Hebreos 4:12', texto: 'Porque la palabra de Dios es viva y eficaz, y más cortante que toda espada de dos filos; y penetra hasta partir el alma y el espíritu.' },
  { ref: 'Hebreos 4:16', texto: 'Acerquémonos, pues, confiadamente al trono de la gracia, para alcanzar misericordia y hallar gracia para el oportuno socorro.' },
  { ref: 'Hebreos 11:1', texto: 'Es pues la fe la certeza de lo que se espera, la convicción de lo que no se ve.' },
  { ref: 'Hebreos 11:6', texto: 'Pero sin fe es imposible agradar a Dios; porque es necesario que el que se acerca a Dios crea que le hay, y que es galardonador de los que le buscan.' },
  { ref: 'Hebreos 12:1', texto: 'Corramos con paciencia la carrera que tenemos por delante, puestos los ojos en Jesús, el autor y consumador de la fe.' },
  { ref: 'Hebreos 13:8', texto: 'Jesucristo es el mismo ayer, y hoy, y por los siglos.' },
  { ref: 'Santiago 1:2-3', texto: 'Hermanos míos, tened por sumo gozo cuando os halléis en diversas pruebas, sabiendo que la prueba de vuestra fe produce paciencia.' },
  { ref: 'Santiago 1:17', texto: 'Toda buena dádiva y todo don perfecto desciende de lo alto, del Padre de las luces, en el cual no hay mudanza, ni sombra de variación.' },
  { ref: 'Santiago 2:17', texto: 'Así también la fe, si no tiene obras, es muerta en sí misma.' },
  { ref: 'Santiago 4:8', texto: 'Acercaos a Dios, y él se acercará a vosotros.' },
  { ref: '1 Pedro 2:9', texto: 'Mas vosotros sois linaje escogido, real sacerdocio, nación santa, pueblo adquirido por Dios, para que anunciéis las virtudes de aquel que os llamó de las tinieblas a su luz admirable.' },
  { ref: '1 Pedro 4:10', texto: 'Cada uno según el don que ha recibido, minístrelo a los otros, como buenos administradores de la multiforme gracia de Dios.' },
  { ref: '1 Pedro 5:7', texto: 'Echando toda vuestra ansiedad sobre él, porque él tiene cuidado de vosotros.' },
  { ref: '1 Pedro 5:10', texto: 'Mas el Dios de toda gracia, que nos llamó a su gloria eterna en Jesucristo, después que hayáis padecido un poco de tiempo, él mismo os perfeccione, afirme, fortalezca y establezca.' },
  { ref: '2 Pedro 1:3', texto: 'Como todas las cosas que pertenecen a la vida y a la piedad nos han sido dadas por su divino poder.' },
  { ref: '1 Juan 1:9', texto: 'Si confesamos nuestros pecados, él es fiel y justo para perdonar nuestros pecados, y limpiarnos de toda maldad.' },
  { ref: '1 Juan 3:1', texto: 'Mirad cuál amor nos ha dado el Padre, para que seamos llamados hijos de Dios.' },
  { ref: '1 Juan 4:7', texto: 'Amados, amémonos unos a otros; porque el amor es de Dios. Todo aquel que ama, es nacido de Dios, y conoce a Dios.' },
  { ref: '1 Juan 4:8', texto: 'El que no ama, no ha conocido a Dios; porque Dios es amor.' },
  { ref: '1 Juan 4:10', texto: 'En esto consiste el amor: no en que nosotros hayamos amado a Dios, sino en que él nos amó a nosotros.' },
  { ref: '1 Juan 4:18', texto: 'En el amor no hay temor, sino que el perfecto amor echa fuera el temor.' },
  { ref: '1 Juan 4:19', texto: 'Nosotros le amamos a él, porque él nos amó primero.' },
  { ref: '1 Juan 5:4', texto: 'Porque todo lo que es nacido de Dios vence al mundo; y esta es la victoria que ha vencido al mundo, nuestra fe.' },
  { ref: 'Apocalipsis 3:20', texto: 'He aquí, yo estoy a la puerta y llamo; si alguno oye mi voz y abre la puerta, entraré a él, y cenaré con él, y él conmigo.' },
  { ref: 'Apocalipsis 21:4', texto: 'Enjugará Dios toda lágrima de los ojos de ellos; y ya no habrá muerte, ni habrá más llanto, ni clamor, ni dolor; porque las primeras cosas pasaron.' },
  { ref: 'Apocalipsis 22:13', texto: 'Yo soy el Alfa y la Omega, el principio y el fin, el primero y el último.' },
];

function getVersiculoDelDia() {
  const periodos = Math.floor(Date.now() / (12 * 60 * 60 * 1000));
  const indice = periodos % VERSICULOS.length;
  return VERSICULOS[indice];
}

interface Reflexion {
  id: string;
  versiculo_ref: string;
  versiculo_texto: string;
  reflexion: string;
  created_at: string;
}

export default function VersiculoPage() {
  const router = useRouter();
  const [inscripcionId, setInscripcionId] = useState<string | null>(null);
  const [reflexiones, setReflexiones] = useState<Reflexion[]>([]);
  const [nuevaReflexion, setNuevaReflexion] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [mostrarFormulario, setMostrarFormulario] = useState(false);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');

  const versiculo = getVersiculoDelDia();

  useEffect(() => {
    inicializar();
  }, []);

  async function inicializar() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push('/'); return; }

    const { data: inscripcion } = await supabase
      .from('servidores_inscripcion')
      .select('id')
      .eq('usuario_id', user.id)
      .eq('retiro_id', '21da7588-f7d9-4bf8-a6f6-ae6c8258c00e')
      .single();

    if (!inscripcion) { router.push('/servidor'); return; }
    setInscripcionId(inscripcion.id);
    await cargarReflexiones(inscripcion.id);
    setCargando(false);
  }

  async function cargarReflexiones(id: string) {
    const { data } = await supabase
      .from('diario_reflexion')
      .select('*')
      .eq('servidor_inscripcion_id', id)
      .order('created_at', { ascending: false });
    if (data) setReflexiones(data);
  }

  async function guardarReflexion() {
    if (!nuevaReflexion.trim() || !inscripcionId) return;
    setGuardando(true);
    setError('');
    const { error: err } = await supabase.from('diario_reflexion').insert({
      servidor_inscripcion_id: inscripcionId,
      versiculo_ref: versiculo.ref,
      versiculo_texto: versiculo.texto,
      reflexion: nuevaReflexion.trim(),
    });
    if (err) {
      setError('No se pudo guardar. Intenta de nuevo.');
    } else {
      setExito('Reflexión guardada');
      setNuevaReflexion('');
      setMostrarFormulario(false);
      await cargarReflexiones(inscripcionId);
      setTimeout(() => setExito(''), 3000);
    }
    setGuardando(false);
  }

  async function eliminarReflexion(id: string) {
    const { error: err } = await supabase.from('diario_reflexion').delete().eq('id', id);
    if (!err && inscripcionId) await cargarReflexiones(inscripcionId);
  }

  function formatFecha(iso: string) {
    const d = new Date(iso);
    return d.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  if (cargando) {
    return (
      <div style={{ minHeight: '100vh', background: '#f7f8fc', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <p style={{ color: '#6b7280', fontFamily: 'system-ui, sans-serif' }}>Cargando...</p>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f7f8fc', fontFamily: 'system-ui, sans-serif' }}>
      {/* Header */}
      <div style={{ background: '#0f1787', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          onClick={() => router.push('/servidor')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center' }}
        >
          <svg width="20" height="20" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
            <path d="M19 12H5M5 12l7 7M5 12l7-7" />
          </svg>
        </button>
        <span style={{ color: 'white', fontFamily: 'Georgia, serif', letterSpacing: 2, fontSize: '15px', fontWeight: 600 }}>EFFETÁ</span>
        <span style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px' }}>— Versículo del día</span>
      </div>

      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '24px 16px 100px' }}>

        {/* Card versículo principal */}
        <div style={{ background: '#0f1787', borderRadius: '20px', padding: '32px 28px', marginBottom: '24px', position: 'relative', overflow: 'hidden' }}>
          {/* Decoración de fondo */}
          <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)' }} />
          <div style={{ position: 'absolute', bottom: '-30px', left: '-10px', width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(255,255,255,0.03)' }} />

          {/* Ícono libro */}
          <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="18" height="18" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
            </svg>
            <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px', letterSpacing: '1px', textTransform: 'uppercase' }}>Versículo del día</span>
          </div>

          <p style={{ color: 'white', fontSize: '18px', lineHeight: '1.7', fontFamily: 'Georgia, serif', fontStyle: 'italic', marginBottom: '20px', position: 'relative', zIndex: 1 }}>
            &ldquo;{versiculo.texto}&rdquo;
          </p>

          <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '14px', fontWeight: 500, position: 'relative', zIndex: 1 }}>
            — {versiculo.ref}
          </p>

          <div style={{ marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
            <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '11px' }}>
              Se renueva cada 12 horas · {VERSICULOS.length} versículos
            </p>
          </div>
        </div>

        {/* Mensaje de éxito */}
        {exito && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <svg width="16" height="16" fill="none" stroke="#16a34a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
              <polyline points="20 6 9 17 4 12" />
            </svg>
            <span style={{ color: '#16a34a', fontSize: '14px' }}>{exito}</span>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '12px', padding: '12px 16px', marginBottom: '16px' }}>
            <p style={{ color: '#dc2626', fontSize: '14px', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Botón escribir reflexión */}
        {!mostrarFormulario && (
          <button
            onClick={() => setMostrarFormulario(true)}
            style={{ width: '100%', background: 'white', border: '1.5px solid #0f1787', borderRadius: '14px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', marginBottom: '24px' }}
          >
            <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" fill="none" stroke="#0f1787" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
              </svg>
            </div>
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: 0, color: '#0f1787', fontWeight: 500, fontSize: '15px' }}>Escribir reflexión</p>
              <p style={{ margin: 0, color: '#6b7280', fontSize: '13px' }}>¿Qué te dice este versículo hoy?</p>
            </div>
          </button>
        )}

        {/* Formulario de reflexión */}
        {mostrarFormulario && (
          <div style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '20px', marginBottom: '24px' }}>
            <p style={{ margin: '0 0 6px', color: '#374151', fontSize: '13px', fontWeight: 500 }}>
              {versiculo.ref}
            </p>
            <p style={{ margin: '0 0 16px', color: '#6b7280', fontSize: '13px', fontStyle: 'italic', lineHeight: '1.5' }}>
              &ldquo;{versiculo.texto.substring(0, 80)}{versiculo.texto.length > 80 ? '...' : ''}&rdquo;
            </p>
            <textarea
              value={nuevaReflexion}
              onChange={e => setNuevaReflexion(e.target.value)}
              placeholder="Escribe tu reflexión personal aquí..."
              style={{
                width: '100%', minHeight: '120px', border: '1px solid #e8eaf0', borderRadius: '10px',
                padding: '12px', fontSize: '15px', fontFamily: 'system-ui, sans-serif', resize: 'vertical',
                outline: 'none', color: '#1f2937', lineHeight: '1.6', boxSizing: 'border-box'
              }}
            />
            <div style={{ display: 'flex', gap: '10px', marginTop: '12px' }}>
              <button
                onClick={() => { setMostrarFormulario(false); setNuevaReflexion(''); }}
                style={{ flex: 1, padding: '12px', border: '1px solid #e8eaf0', borderRadius: '10px', background: 'white', color: '#6b7280', fontSize: '14px', cursor: 'pointer' }}
              >
                Cancelar
              </button>
              <button
                onClick={guardarReflexion}
                disabled={guardando || !nuevaReflexion.trim()}
                style={{
                  flex: 2, padding: '12px', border: 'none', borderRadius: '10px',
                  background: guardando || !nuevaReflexion.trim() ? '#9ca3af' : '#0f1787',
                  color: 'white', fontSize: '14px', fontWeight: 500, cursor: guardando || !nuevaReflexion.trim() ? 'not-allowed' : 'pointer'
                }}
              >
                {guardando ? 'Guardando...' : 'Guardar reflexión'}
              </button>
            </div>
          </div>
        )}

        {/* Historial de reflexiones */}
        {reflexiones.length > 0 && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
              <svg width="16" height="16" fill="none" stroke="#6b7280" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
              </svg>
              <p style={{ margin: 0, color: '#374151', fontSize: '15px', fontWeight: 500 }}>Mi diario de reflexión</p>
              <span style={{ background: '#eef0ff', color: '#0f1787', fontSize: '12px', fontWeight: 500, borderRadius: '20px', padding: '2px 8px' }}>
                {reflexiones.length}
              </span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {reflexiones.map((r) => (
                <div key={r.id} style={{ background: 'white', border: '1px solid #e8eaf0', borderRadius: '16px', padding: '18px', position: 'relative' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                    <div>
                      <p style={{ margin: 0, color: '#0f1787', fontSize: '12px', fontWeight: 500 }}>{r.versiculo_ref}</p>
                      <p style={{ margin: '2px 0 0', color: '#9ca3af', fontSize: '11px' }}>{formatFecha(r.created_at)}</p>
                    </div>
                    <button
                      onClick={() => eliminarReflexion(r.id)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px', color: '#d1d5db' }}
                    >
                      <svg width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                        <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a1 1 0 011-1h4a1 1 0 011 1v2" />
                      </svg>
                    </button>
                  </div>

                  <div style={{ borderLeft: '3px solid #eef0ff', paddingLeft: '12px', marginBottom: '12px' }}>
                    <p style={{ margin: 0, color: '#6b7280', fontSize: '12px', fontStyle: 'italic', lineHeight: '1.5' }}>
                      &ldquo;{r.versiculo_texto.substring(0, 100)}{r.versiculo_texto.length > 100 ? '...' : ''}&rdquo;
                    </p>
                  </div>

                  <p style={{ margin: 0, color: '#1f2937', fontSize: '14px', lineHeight: '1.6' }}>
                    {r.reflexion}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Estado vacío */}
        {reflexiones.length === 0 && !mostrarFormulario && (
          <div style={{ textAlign: 'center', padding: '32px 20px' }}>
            <div style={{ width: '56px', height: '56px', borderRadius: '16px', background: '#eef0ff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
              <svg width="28" height="28" fill="none" stroke="#0f1787" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                <path d="M4 19.5A2.5 2.5 0 016.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
              </svg>
            </div>
            <p style={{ margin: '0 0 6px', color: '#374151', fontSize: '15px', fontWeight: 500 }}>Tu diario está vacío</p>
            <p style={{ margin: 0, color: '#9ca3af', fontSize: '14px', lineHeight: '1.5' }}>
              Empieza escribiendo tu primera reflexión sobre el versículo de hoy
            </p>
          </div>
        )}

      </div>
    </div>
  );
}
