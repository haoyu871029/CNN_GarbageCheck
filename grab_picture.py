from selenium import webdriver
import time
import requests

chromDriver = 'chromedriver.exe'

array = []
m = 0

driver = webdriver.Chrome(chromDriver)

url = 'https://pic.sogou.com/pics?query=%E5%AF%B6%E7%89%B9%E7%93%B6&w=05009900'

driver.get(url)
pos = 0

for i in range(1, 40):
    pos += i * 500  # 每次下滾500
    js = "document.documentElement.scrollTop=%d" % pos
    driver.execute_script(js)
    time.sleep(1)

    for j in driver.find_elements_by_tag_name("img"):
        if 'gif' not in j.get_attribute("src") and 'logo' not in j.get_attribute("src") and j.get_attribute(
                "src") not in array:
            array.append(j.get_attribute("src"))
            print(j.get_attribute("src"))

for i in array:
    if i != None:
        m += 1

        filename = "sogoimgs/image" + str(m) + '.jpg'
        print(filename)
        # 保存圖片
        with open(filename, 'wb') as handle:
            response = requests.get(i, stream=True)

            if not response.ok:
                print(response)

            for block in response.iter_content(1024):
                if not block:
                    break
                handle.write(block)

print("finish")
