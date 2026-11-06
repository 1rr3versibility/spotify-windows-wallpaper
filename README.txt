TALIA · SPOTIFY

Установка
Запусти TaliaSetup.exe. Он ставит плеер в %LOCALAPPDATA%\Programs\TaliaPlayer, кладёт Spicetify и подключает к Spotify расширение Talia. Права администратора не нужны. Spotify при этом перезапустится.

Плеер
Мини-плеер стоит поверх окон, его можно таскать за свободную часть панели. В меню ☰ меняется персонаж: у Capri и Талии своя тема плеера и обоев. Персонаж всегда сидит на мини-плеере, а во время музыки маленькой фигуркой танцует на полосе перемотки основного плеера на обоях.

Обои
☰ → «Обои рабочего стола» ставит за иконками на каждый монитор страницу в стиле Spotify: плеер, плейлисты и миксы, любимые треки, очередь, поиск, страницы артистов и альбомов, DJ, лайки. Фон рисует шейдер в цветах обложки и пульсирует под музыку, режимов около ста, режим меняется вместе с треком. Если у трека есть видеообложка Spotify, она играет поверх обложки. Когда монитор закрыт окном на весь экран или игрой, обои на нём стоят на паузе.

Spotify и Spicetify
Данные и управление идут через расширение Spicetify внутри приложения Spotify, без Spotify Web API, ключей и входа. Пункт меню ☰ → «Spicetify» показывает, подключён ли Spotify. После обновления Spotify нажми там «Переприменить после обновления Spotify». Если Spotify запущен без мода, мини-плеер работает через системную медиасессию Windows. Ошибки пишутся в %LOCALAPPDATA%\TaliaSpotifyMiniPlayer\TaliaPlayer.log.

Персонажи
Каждая папка с файлом frames.tsv внутри assets/characters/<персонаж> считается танцем. Имена sit, sit-arrive, sit-leave, sit-music, walk, arrive и leave заняты под служебные клипы. Файл anchor.txt в папке клипа задаёт точку бедра (hip) или ступней (feet) на холсте кадра.

Исходники и сборка
.\build.ps1 собирает плеер, .\build-setup.ps1 собирает установщик. Нужен Windows SDK с объединённым Windows.winmd либо путь к нему через -WindowsMetadata. Библиотеки WebView2 лежат в lib\webview2 (Microsoft.Web.WebView2 1.0.4314.35, лицензия lib\webview2\LICENSE-WebView2.txt). Spicetify: https://github.com/spicetify/cli, лицензия LGPL-2.1, файл LICENSE-SPICETIFY.txt.
Оригинальный MiniPlayer, медиасессия, тема и спрайты Capri взяты из Capri Desktop: https://github.com/lachydotmcg/capri-desktop, лицензия LICENSE-CAPRI.md.
Талия Янг: Cyberpunk: Edgerunners 2, CD PROJEKT RED и TRIGGER. Арт и хореография: assets/Artwork-CREDITS.txt.
